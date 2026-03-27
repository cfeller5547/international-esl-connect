import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AppError } from "@/server/errors";
import {
  buildHomeworkCompletionSummary,
  createInitialHomeworkSessionState,
  getRecommendedHomeworkAction,
  hydrateHomeworkSessionState,
  inferHomeworkContentShape,
  type HomeworkCoachAction,
  type HomeworkContentShape,
  type HomeworkQuestionState,
  type HomeworkSessionState,
} from "@/lib/homework-help";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/prisma";

import {
  extractHomeworkTextFromSource,
  createReviewedHomeworkQuestion,
  generateHomeworkCoachReply,
  parseHomeworkAssignment,
  type HomeworkQuestion,
} from "../ai/homework-help";
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

type HomeworkParsedPayload = {
  rawText?: string | null;
  originalFileName?: string | null;
  extractionNotes?: string[];
  extractionConfidence?: number;
  extractionMethod?: string;
  assignmentTitle?: string;
  assignmentSummary?: string;
  subject?: string;
  difficultyLevel?: string;
  contentShape?: HomeworkContentShape;
  reviewNotes?: string[];
  questions?: HomeworkQuestion[];
};

function getParsedPayload(value: unknown) {
  return (value ?? {}) as HomeworkParsedPayload;
}

function getParsedQuestions(parsedPayload: HomeworkParsedPayload) {
  return Array.isArray(parsedPayload.questions) ? parsedPayload.questions : [];
}

function getDraftText(value: string | null | undefined) {
  return typeof value === "string" ? value : "";
}

function getSessionState(value: unknown, questions: HomeworkQuestion[], steps: Array<{
  questionIndex: number;
  result: string;
  hintLevelUsed: number;
  studentAnswer: unknown;
  feedbackPayload: unknown;
}>) {
  return hydrateHomeworkSessionState({
    questions,
    savedState: value,
    steps,
  });
}

function getNextIncompleteQuestionIndex(questionStates: HomeworkQuestionState[]) {
  const nextIndex = questionStates.findIndex((questionState) => questionState.status !== "completed");
  return nextIndex >= 0 ? nextIndex : Math.max(questionStates.length - 1, 0);
}

function serializeSessionState(sessionState: HomeworkSessionState) {
  return JSON.parse(JSON.stringify(sessionState)) as Prisma.InputJsonValue;
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
      const parsedPayload = getParsedPayload(upload.parsedPayload);

      try {
        const extraction =
          typeof parsedPayload.rawText === "string" && parsedPayload.rawText.trim().length > 0
            ? {
                rawText: parsedPayload.rawText,
                extractionNotes: parsedPayload.extractionNotes ?? [
                  "Loaded the pasted assignment text directly.",
                ],
                extractionConfidence: parsedPayload.extractionConfidence ?? 0.95,
                extractionMethod: parsedPayload.extractionMethod ?? "direct_text",
              }
            : upload.fileUrl.startsWith("inline://")
              ? {
                  rawText: parsedPayload.rawText ?? "",
                  extractionNotes: ["Loaded the pasted assignment text directly."],
                  extractionConfidence: parsedPayload.rawText?.trim() ? 0.95 : 0.2,
                  extractionMethod: "direct_text",
                }
              : await extractHomeworkTextFromSource({
                  filePath: upload.fileUrl,
                  inputType: upload.inputType as "pdf" | "image" | "text",
                  originalFileName: parsedPayload.originalFileName ?? null,
                });

        await prisma.homeworkUpload.update({
          where: { id: upload.id },
          data: {
            status: "segmenting_questions",
            parsedPayload: {
              ...parsedPayload,
              rawText: extraction.rawText,
              extractionNotes: extraction.extractionNotes,
              extractionConfidence: extraction.extractionConfidence,
              extractionMethod: extraction.extractionMethod,
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
            detailsPayload: {
              extractionMethod: extraction.extractionMethod,
              extractionConfidence: extraction.extractionConfidence,
            },
          },
        });
      } catch {
        await prisma.homeworkUpload.update({
          where: { id: upload.id },
          data: {
            status: "failed",
            errorCode: "HOMEWORK_PARSE_UNREADABLE",
          },
        });

        await prisma.homeworkParseJob.updateMany({
          where: {
            homeworkUploadId: upload.id,
            stage: "extracting_text",
          },
          data: {
            status: "failed",
            completedAt: new Date(),
            detailsPayload: {
              errorCode: "HOMEWORK_PARSE_UNREADABLE",
            },
          },
        });
      }
    }

    const refreshed = await prisma.homeworkUpload.findUniqueOrThrow({
      where: { id: upload.id },
    });

    if (refreshed.status === "segmenting_questions") {
      const parsedPayload = getParsedPayload(refreshed.parsedPayload);
      const rawText = String(parsedPayload.rawText ?? "");

      try {
        const parsed = await parseHomeworkAssignment({
          rawText,
          inputType: refreshed.inputType as "pdf" | "image" | "text",
          originalFileName: parsedPayload.originalFileName ?? null,
        });
        const needsReview =
          parsed.parseConfidence < 0.7 ||
          (parsedPayload.extractionConfidence ?? 1) < 0.5 ||
          parsed.reviewNotes.length > 0;
        const status =
          rawText.trim().length === 0
            ? "failed"
            : parsed.questions.length === 0
              ? "failed"
              : needsReview
                ? "needs_review"
                : "parsed";
        const errorCode =
          status === "failed"
            ? rawText.trim().length === 0
              ? "HOMEWORK_PARSE_UNREADABLE"
              : "HOMEWORK_PARSE_FAILED"
            : null;

        const updated = await prisma.homeworkUpload.update({
          where: { id: refreshed.id },
          data: {
            status,
            parseConfidence: parsed.parseConfidence,
            parserVersion: "homework_parser_v2",
            errorCode,
            parsedPayload: {
              ...parsedPayload,
              assignmentTitle: parsed.assignmentTitle,
              assignmentSummary: parsed.assignmentSummary,
              subject: parsed.subject,
              difficultyLevel: parsed.difficultyLevel,
              contentShape: parsed.contentShape,
              reviewNotes: parsed.reviewNotes,
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
            detailsPayload: {
              parseConfidence: parsed.parseConfidence,
              detectedQuestionCount: parsed.questions.length,
            },
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
      } catch {
        await prisma.homeworkUpload.update({
          where: { id: refreshed.id },
          data: {
            status: "failed",
            errorCode: "HOMEWORK_PARSE_FAILED",
          },
        });
      }
    }

    return prisma.homeworkUpload.findUniqueOrThrow({
      where: { id: upload.id },
    });
  },

  async startSession(userId: string, homeworkUploadId: string) {
    const upload = await prisma.homeworkUpload.findFirst({
      where: {
        id: homeworkUploadId,
        userId,
      },
    });

    if (!upload) {
      throw new AppError("NOT_FOUND", "Homework upload not found.", 404);
    }

    if (upload.status !== "parsed" && upload.status !== "needs_review") {
      throw new AppError(
        "INVALID_STATE",
        "Homework help is not ready yet. Upload parsing must finish first.",
        409
      );
    }

    const parsedPayload = getParsedPayload(upload.parsedPayload);
    const questions = getParsedQuestions(parsedPayload);

    if (questions.length === 0) {
      throw new AppError(
        "HOMEWORK_PARSE_FAILED",
        "We could not recover any homework questions from this upload yet.",
        422
      );
    }

    const existing = await prisma.homeworkHelpSession.findFirst({
      where: {
        userId,
        homeworkUploadId,
        status: "active",
      },
      include: {
        steps: true,
      },
    });

    if (existing) {
      const existingState = getSessionState(existing.sessionState, questions, existing.steps);
      const existingIsComplete =
        existingState.questionStates.length > 0 &&
        existingState.questionStates.every((questionState) => questionState.status === "completed");

      if (!existingIsComplete) {
        return existing;
      }

      await prisma.homeworkHelpSession.update({
        where: { id: existing.id },
        data: {
          status: "completed",
          completedAt: existing.completedAt ?? new Date(),
          sessionState: serializeSessionState(existingState),
        },
      });
    }

    const initialState = createInitialHomeworkSessionState(questions.length);
    const session = await prisma.homeworkHelpSession.create({
      data: {
        userId,
        homeworkUploadId,
        status: "active",
        sessionState: serializeSessionState(initialState),
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

  async reviewUpload({
    userId,
    homeworkUploadId,
    questions,
  }: {
    userId: string;
    homeworkUploadId: string;
    questions: Array<{
      promptText: string;
    }>;
  }) {
    const upload = await prisma.homeworkUpload.findFirst({
      where: {
        id: homeworkUploadId,
        userId,
      },
    });

    if (!upload) {
      throw new AppError("NOT_FOUND", "Homework upload not found.", 404);
    }

    const parsedPayload = getParsedPayload(upload.parsedPayload);
    const reviewedQuestions = questions
      .map((question, index) =>
        createReviewedHomeworkQuestion({
          promptText: question.promptText,
          index,
          existingQuestion: null,
        })
      )
      .filter((question): question is HomeworkQuestion => Boolean(question));

    if (reviewedQuestions.length === 0) {
      throw new AppError(
        "HOMEWORK_PARSE_REVIEW_REQUIRED",
        "Keep at least one question before starting Homework Help.",
        422
      );
    }

    const contentShape = inferHomeworkContentShape({
      rawText: String(parsedPayload.rawText ?? reviewedQuestions.map((question) => question.promptText).join("\n")),
      questionCount: reviewedQuestions.length,
    });

    const updated = await prisma.homeworkUpload.update({
      where: { id: upload.id },
      data: {
        status: "parsed",
        parsedPayload: {
          ...parsedPayload,
          contentShape,
          reviewNotes: [],
          questions: reviewedQuestions,
        },
      },
    });

    await trackEvent({
      eventName: "homework_parse_review_saved",
      route: "/app/tools/homework",
      userId,
      properties: {
        homework_upload_id: updated.id,
        detected_question_count: reviewedQuestions.length,
      },
    });

    return updated;
  },

  async saveSessionState({
    sessionId,
    userId,
    questionIndex,
    latestDraft,
    currentQuestionIndex,
  }: {
    sessionId: string;
    userId: string;
    questionIndex: number;
    latestDraft: string;
    currentQuestionIndex: number;
  }) {
    const session = await prisma.homeworkHelpSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        homeworkUpload: true,
        steps: true,
      },
    });

    if (!session) {
      throw new AppError("NOT_FOUND", "Homework session not found.", 404);
    }

    const parsedPayload = getParsedPayload(session.homeworkUpload.parsedPayload);
    const questions = getParsedQuestions(parsedPayload);
    const sessionState = getSessionState(session.sessionState, questions, session.steps);
    const questionState = {
      ...(sessionState.questionStates[questionIndex] ?? {
        index: questionIndex,
        status: "not_started",
        latestDraft: "",
        hintLevel: 0,
        recommendedAction: "explain" as HomeworkCoachAction,
        coachEntries: [],
      }),
    };

    questionState.latestDraft = latestDraft;
    if (questionState.status !== "completed") {
      questionState.status = latestDraft.trim() ? "in_progress" : "not_started";
    }
    questionState.recommendedAction = getRecommendedHomeworkAction(questionState);

    sessionState.questionStates[questionIndex] = questionState;
    sessionState.currentQuestionIndex =
      sessionState.questionStates[currentQuestionIndex] ? currentQuestionIndex : questionIndex;

    await prisma.homeworkHelpSession.update({
      where: { id: session.id },
      data: {
        sessionState: serializeSessionState(sessionState),
      },
    });

    return sessionState;
  },

  async submitStep({
    sessionId,
    questionIndex,
    studentAnswer,
    action,
    userId,
  }: {
    sessionId: string;
    questionIndex: number;
    studentAnswer: string;
    action: HomeworkCoachAction;
    userId: string;
  }) {
    const session = await prisma.homeworkHelpSession.findFirstOrThrow({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        homeworkUpload: true,
        steps: true,
      },
    });

    if (session.status !== "active") {
      throw new AppError(
        "INVALID_STATE",
        "This homework session is already finished.",
        409
      );
    }

    const parsedPayload = getParsedPayload(session.homeworkUpload.parsedPayload);
    const questions = getParsedQuestions(parsedPayload);
    const question = questions[questionIndex];

    if (!question) {
      throw new AppError("NOT_FOUND", "Homework question not found.", 404);
    }

    const sessionState = getSessionState(session.sessionState, questions, session.steps);
    const currentQuestionState = {
      ...(sessionState.questionStates[questionIndex] ?? {
        index: questionIndex,
        status: "not_started",
        latestDraft: "",
        hintLevel: 0,
        recommendedAction: "explain" as HomeworkCoachAction,
        coachEntries: [],
      }),
    };

    const priorHintLevel = session.steps.reduce((max, step) => {
      if (step.questionIndex !== questionIndex) {
        return max;
      }

      return Math.max(max, step.hintLevelUsed);
    }, 0);
    const hintLevelServed =
      action === "hint"
        ? Math.min(Math.max(priorHintLevel + 1, 1), 3)
        : priorHintLevel;
    const feedback = await generateHomeworkCoachReply({
      action,
      question,
      assignmentTitle: parsedPayload.assignmentTitle ?? "Homework assignment",
      assignmentSummary:
        parsedPayload.assignmentSummary ??
        "Work through the assignment one question at a time.",
      studentAnswer,
      hintLevel: hintLevelServed === 0 ? 1 : hintLevelServed,
    });
    const shouldAdvance = action === "submit" ? feedback.shouldAdvance : false;
    const readyToSubmit = action !== "submit" && feedback.shouldAdvance;
    const nextHintLevelAvailable = action === "hint" ? Math.min(hintLevelServed + 1, 3) : hintLevelServed;

    await prisma.homeworkHelpStep.create({
      data: {
        sessionId,
        questionIndex,
        studentAnswer: {
          text: studentAnswer,
          action,
        },
        hintLevelUsed: hintLevelServed,
        result: shouldAdvance ? "completed" : feedback.result,
        feedbackPayload: {
          action,
          ...feedback,
          readyToSubmit,
          shouldAdvance,
          hintLevelServed,
          nextHintLevelAvailable,
        },
      },
    });

    const nextQuestionState: HomeworkQuestionState = {
      ...currentQuestionState,
      latestDraft: studentAnswer,
      hintLevel: Math.max(currentQuestionState.hintLevel, hintLevelServed),
      coachEntries: [
        ...currentQuestionState.coachEntries,
        {
          action,
          coachTitle: feedback.coachTitle,
          coachMessage: feedback.coachMessage,
          checklist: feedback.checklist,
          suggestedStarter: feedback.suggestedStarter,
          result: shouldAdvance ? "ready" : feedback.result,
          readyToSubmit,
        },
      ],
      status: shouldAdvance
        ? "completed"
        : readyToSubmit
          ? "ready_to_submit"
          : studentAnswer.trim() || currentQuestionState.coachEntries.length > 0
            ? "in_progress"
            : "not_started",
      recommendedAction: "explain",
    };
    nextQuestionState.recommendedAction = getRecommendedHomeworkAction(nextQuestionState);
    sessionState.questionStates[questionIndex] = nextQuestionState;

    if (shouldAdvance) {
      sessionState.currentQuestionIndex = getNextIncompleteQuestionIndex(
        sessionState.questionStates
      );
    } else {
      sessionState.currentQuestionIndex = questionIndex;
    }

    if (action === "submit") {
      await trackEvent({
        eventName: "homework_step_submitted",
        route: `/app/tools/homework/session/${sessionId}`,
        userId,
        properties: {
          question_index: questionIndex,
          result: shouldAdvance ? "completed" : feedback.result,
        },
      });
    }

    if (action === "hint") {
      await trackEvent({
        eventName: "homework_hint_requested",
        route: `/app/tools/homework/session/${sessionId}`,
        userId,
        properties: {
          current_hint_level: hintLevelServed,
        },
      });
    }

    const sessionCompleted =
      sessionState.questionStates.length > 0 &&
      sessionState.questionStates.every((questionState) => questionState.status === "completed");
    const completionSummary = sessionCompleted
      ? buildHomeworkCompletionSummary({
          questions,
          state: sessionState,
        })
      : null;

    await prisma.homeworkHelpSession.update({
      where: { id: sessionId },
      data: {
        status: sessionCompleted ? "completed" : "active",
        completedAt: sessionCompleted ? new Date() : null,
        sessionState: serializeSessionState(sessionState),
      },
    });

    if (sessionCompleted) {
      await trackEvent({
        eventName: "homework_session_completed",
        route: `/app/tools/homework/session/${sessionId}`,
        userId,
        properties: {
          questions_completed: questions.length,
          avg_hint_level:
            sessionState.questionStates.reduce(
              (sum, questionState) => sum + questionState.hintLevel,
              0
            ) / Math.max(sessionState.questionStates.length, 1),
        },
      });

      await StreakService.recordQualifyingActivity(userId);
    }

    return {
      action,
      result: shouldAdvance ? "ready" : feedback.result,
      coachTitle: feedback.coachTitle,
      coachMessage: feedback.coachMessage,
      checklist: feedback.checklist,
      suggestedStarter: feedback.suggestedStarter,
      shouldAdvance,
      readyToSubmit,
      nextHintLevelAvailable,
      recommendedAction: nextQuestionState.recommendedAction,
      questionStatus: nextQuestionState.status,
      currentQuestionIndex: sessionState.currentQuestionIndex,
      sessionCompleted,
      completionSummary,
    };
  },
};
