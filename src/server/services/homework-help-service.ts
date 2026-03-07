import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { AppError } from "@/server/errors";
import { prisma } from "@/server/prisma";

import { generateHomeworkFeedback, parseHomeworkText } from "../ai/heuristics";
import { trackEvent } from "../analytics";

import { StreakService } from "./streak-service";
import { UsageService } from "./usage-service";

const STORAGE_DIR = path.join(process.cwd(), "storage");

async function ensureStorageDir() {
  await mkdir(STORAGE_DIR, { recursive: true });
}

async function saveUploadFile(id: string, file: File) {
  await ensureStorageDir();
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(STORAGE_DIR, `${id}-${file.name}`);
  await writeFile(filePath, buffer);
  return filePath;
}

async function extractTextFromFile(filePath: string, inputType: string) {
  if (inputType === "text") {
    return readFile(filePath, "utf8");
  }

  if (inputType === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const fileBuffer = await readFile(filePath);
    const parser = new PDFParse({ data: fileBuffer });
    const parsed = await parser.getText();
    await parser.destroy();
    return parsed.text;
  }

  return "Image OCR is not available in local mode. Please review the extracted questions manually.";
}

export const HomeworkHelpService = {
  async createUpload({
    userId,
    inputType,
    file,
    text,
  }: {
    userId: string;
    inputType: "pdf" | "image" | "text";
    file?: File | null;
    text?: string | null;
  }) {
    await UsageService.assertWithinLimit(userId, "homework_uploads");
    await UsageService.increment(userId, "homework_uploads");

    const uploadId = crypto.randomUUID();
    const fileUrl =
      file && file.size > 0 ? await saveUploadFile(uploadId, file) : `inline://${uploadId}.txt`;

    const upload = await prisma.homeworkUpload.create({
      data: {
        id: uploadId,
        userId,
        fileUrl,
        inputType,
        status: "extracting_text",
        parsedPayload: {
          rawText: text ?? null,
          originalFileName: file?.name ?? null,
        },
      },
    });

    await prisma.homeworkParseJob.createMany({
      data: [
        {
          homeworkUploadId: upload.id,
          stage: "extracting_text",
          status: "queued",
          detailsPayload: {},
        },
        {
          homeworkUploadId: upload.id,
          stage: "segmenting_questions",
          status: "queued",
          detailsPayload: {},
        },
      ],
    });

    await trackEvent({
      eventName: "homework_upload_started",
      route: "/app/tools/homework",
      userId,
      properties: {
        input_type: inputType,
      },
    });

    return upload;
  },

  async getUpload(uploadId: string, userId: string) {
    const upload = await prisma.homeworkUpload.findFirst({
      where: {
        id: uploadId,
        userId,
      },
      include: {
        parseJobs: true,
      },
    });

    if (!upload) {
      throw new AppError("NOT_FOUND", "Homework upload not found.", 404);
    }

    if (upload.status === "extracting_text") {
      const rawText =
        (upload.parsedPayload as Record<string, unknown>)?.rawText ??
        (await extractTextFromFile(upload.fileUrl, upload.inputType));

      await prisma.homeworkUpload.update({
        where: { id: upload.id },
        data: {
          status: "segmenting_questions",
          parsedPayload: {
            ...(upload.parsedPayload as Record<string, unknown>),
            rawText,
          },
        },
      });

      await prisma.homeworkParseJob.updateMany({
        where: {
          homeworkUploadId: upload.id,
          stage: "extracting_text",
        },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
      });
    }

    const refreshed = await prisma.homeworkUpload.findUniqueOrThrow({
      where: { id: upload.id },
    });

    if (refreshed.status === "segmenting_questions") {
      const rawText = String(
        (refreshed.parsedPayload as Record<string, unknown>)?.rawText ?? ""
      );
      const parsed = parseHomeworkText(rawText);
      const status =
        parsed.questions.length === 0
          ? "failed"
          : parsed.parseConfidence < 0.65
            ? "needs_review"
            : "parsed";

      const updated = await prisma.homeworkUpload.update({
        where: { id: refreshed.id },
        data: {
          status,
          parseConfidence: parsed.parseConfidence,
          parserVersion: "homework_parser_v1",
          errorCode: status === "failed" ? "HOMEWORK_PARSE_FAILED" : null,
          parsedPayload: {
            ...(refreshed.parsedPayload as Record<string, unknown>),
            questions: parsed.questions,
          },
        },
      });

      await prisma.homeworkParseJob.updateMany({
        where: {
          homeworkUploadId: upload.id,
          stage: "segmenting_questions",
        },
        data: {
          status: status === "failed" ? "failed" : "completed",
          completedAt: new Date(),
        },
      });

      if (status === "parsed") {
        await trackEvent({
          eventName: "homework_upload_parsed",
          route: "/app/tools/homework",
          userId,
          properties: {
            homework_upload_id: updated.id,
            detected_question_count: parsed.questions.length,
          },
        });
      }

      if (status === "needs_review") {
        await trackEvent({
          eventName: "homework_parse_needs_review",
          route: "/app/tools/homework",
          userId,
          properties: {
            homework_upload_id: updated.id,
            parse_confidence: updated.parseConfidence,
          },
        });
      }

      if (status === "failed") {
        await trackEvent({
          eventName: "homework_parse_failed",
          route: "/app/tools/homework",
          userId,
          properties: {
            homework_upload_id: updated.id,
            error_code: updated.errorCode,
          },
        });
      }
    }

    return prisma.homeworkUpload.findUniqueOrThrow({
      where: { id: upload.id },
    });
  },

  async startSession(userId: string, homeworkUploadId: string) {
    const existing = await prisma.homeworkHelpSession.findFirst({
      where: {
        userId,
        homeworkUploadId,
        status: "active",
      },
    });

    if (existing) {
      return existing;
    }

    const session = await prisma.homeworkHelpSession.create({
      data: {
        userId,
        homeworkUploadId,
        status: "active",
      },
    });

    await trackEvent({
      eventName: "homework_session_started",
      route: `/app/tools/homework/session/${session.id}`,
      userId,
      properties: {
        session_id: session.id,
      },
    });

    return session;
  },

  async submitStep({
    sessionId,
    questionIndex,
    studentAnswer,
    requestHintLevel,
    userId,
  }: {
    sessionId: string;
    questionIndex: number;
    studentAnswer: string;
    requestHintLevel: number;
    userId: string;
  }) {
    const session = await prisma.homeworkHelpSession.findFirstOrThrow({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        homeworkUpload: true,
      },
    });

    const parsedPayload = session.homeworkUpload.parsedPayload as Record<string, unknown>;
    const questions = Array.isArray(parsedPayload.questions)
      ? parsedPayload.questions
      : [];
    const question = questions[questionIndex] as
      | { promptText?: string }
      | undefined;

    const feedback = generateHomeworkFeedback({
      prompt: question?.promptText ?? "this question",
      answer: studentAnswer,
      hintLevel: requestHintLevel,
    });

    await prisma.homeworkHelpStep.create({
      data: {
        sessionId,
        questionIndex,
        studentAnswer: {
          text: studentAnswer,
        },
        hintLevelUsed: feedback.hintLevelServed,
        result: feedback.result,
        feedbackPayload: feedback,
      },
    });

    await trackEvent({
      eventName: "homework_step_submitted",
      route: `/app/tools/homework/session/${sessionId}`,
      userId,
      properties: {
        question_index: questionIndex,
        result: feedback.result,
      },
    });

    if (requestHintLevel > 0) {
      await trackEvent({
        eventName: "homework_hint_requested",
        route: `/app/tools/homework/session/${sessionId}`,
        userId,
        properties: {
          current_hint_level: requestHintLevel,
        },
      });
    }

    if (questionIndex >= questions.length - 1 && questions.length > 0) {
      await prisma.homeworkHelpSession.update({
        where: { id: sessionId },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
      });

      await trackEvent({
        eventName: "homework_session_completed",
        route: `/app/tools/homework/session/${sessionId}`,
        userId,
        properties: {
          questions_completed: questions.length,
          avg_hint_level: requestHintLevel,
        },
      });

      await StreakService.recordQualifyingActivity(userId);
    }

    return {
      result: feedback.result,
      feedback: feedback.feedback,
      nextHintLevelAvailable: feedback.nextHintLevelAvailable,
    };
  },
};
