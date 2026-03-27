/** @vitest-environment node */

import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@/server/openai", () => ({
  openai: null,
}));

import { parseHomeworkAssignment } from "@/server/ai/homework-help";
import { prisma } from "@/server/prisma";
import { HomeworkHelpService } from "@/server/services/homework-help-service";

describe("homework help", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("builds a structured fallback question map from numbered assignment text", async () => {
    const parsed = await parseHomeworkAssignment({
      rawText: [
        "1. Explain why the main character decides to leave home.",
        "2. Compare the village at the start of the story with the village at the end.",
      ].join("\n"),
      inputType: "text",
    });

    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0]?.promptText).toMatch(/main character/i);
    expect(parsed.questions[0]?.planSteps.length).toBeGreaterThan(0);
    expect(parsed.assignmentSummary).toMatch(/detected 2 question/i);
  });

  it("treats a single pasted question as a usable one-question flow", async () => {
    const parsed = await parseHomeworkAssignment({
      rawText: "Why did the Civil War start?",
      inputType: "text",
    });

    expect(parsed.questions).toHaveLength(1);
    expect(parsed.contentShape).toBe("single_question");
    expect(parsed.questions[0]?.promptText).toMatch(/civil war/i);
  });

  it("saves a lightweight review edit before starting", async () => {
    const user = await prisma.user.create({
      data: {
        email: `homework-review-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
      },
    });

    const upload = await prisma.homeworkUpload.create({
      data: {
        userId: user.id,
        fileUrl: "inline://review-homework.txt",
        inputType: "text",
        status: "needs_review",
        parseConfidence: 0.58,
        parserVersion: "test",
        parsedPayload: {
          assignmentTitle: "Worksheet",
          assignmentSummary: "Review the detected prompts before you start.",
          questions: [
            {
              index: 1,
              promptText: "Wrng OCR question",
              questionType: "short_answer",
              focusSkill: "writing",
              studentGoal: "Answer clearly.",
              answerFormat: "Write 1-2 sentences.",
              successCriteria: ["Answer the question."],
              planSteps: ["Say the main idea first."],
              commonPitfalls: ["Being too short."],
            },
            {
              index: 2,
              promptText: "Delete this line",
              questionType: "short_answer",
              focusSkill: "writing",
              studentGoal: "Answer clearly.",
              answerFormat: "Write 1-2 sentences.",
              successCriteria: ["Answer the question."],
              planSteps: ["Say the main idea first."],
              commonPitfalls: ["Being too short."],
            },
          ],
        },
      },
    });

    const reviewed = await HomeworkHelpService.reviewUpload({
      userId: user.id,
      homeworkUploadId: upload.id,
      questions: [
        {
          promptText: "Wrong OCR question fixed",
        },
      ],
    });

    const reviewedPayload = reviewed.parsedPayload as {
      questions?: Array<{ promptText: string }>;
      contentShape?: string;
    };

    expect(reviewed.status).toBe("parsed");
    expect(reviewedPayload.questions).toHaveLength(1);
    expect(reviewedPayload.questions?.[0]?.promptText).toMatch(/fixed/i);
    expect(reviewedPayload.contentShape).toBe("single_question");
  });

  it("autosaves session draft state on the existing session record", async () => {
    const user = await prisma.user.create({
      data: {
        email: `homework-state-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
      },
    });

    const upload = await prisma.homeworkUpload.create({
      data: {
        userId: user.id,
        fileUrl: "inline://state-homework.txt",
        inputType: "text",
        status: "parsed",
        parseConfidence: 0.91,
        parserVersion: "test",
        parsedPayload: {
          assignmentTitle: "Short response",
          assignmentSummary: "Answer one question clearly.",
          contentShape: "single_question",
          questions: [
            {
              index: 1,
              promptText: "Explain why the team won the game.",
              questionType: "short_answer",
              focusSkill: "writing",
              studentGoal: "Explain the main reason with detail.",
              answerFormat: "Write 2-3 sentences.",
              successCriteria: [
                "Answer the main question.",
                "Include one supporting detail.",
              ],
              planSteps: [
                "Name the main reason first.",
                "Add one supporting detail.",
              ],
              commonPitfalls: ["Giving only a short opinion."],
            },
          ],
        },
      },
    });

    const session = await HomeworkHelpService.startSession(user.id, upload.id);

    await HomeworkHelpService.saveSessionState({
      sessionId: session.id,
      userId: user.id,
      questionIndex: 0,
      latestDraft: "The team won because they defended well the whole game.",
      currentQuestionIndex: 0,
    });

    const refreshed = await prisma.homeworkHelpSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    const sessionState = refreshed.sessionState as {
      currentQuestionIndex?: number;
      questionStates?: Array<{ latestDraft?: string; status?: string }>;
    };

    expect(sessionState.currentQuestionIndex).toBe(0);
    expect(sessionState.questionStates?.[0]?.latestDraft).toMatch(/defended well/i);
    expect(sessionState.questionStates?.[0]?.status).toBe("in_progress");
  });

  it("only advances the session after a meaningful submit", async () => {
    const user = await prisma.user.create({
      data: {
        email: `homework-help-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
      },
    });

    const upload = await prisma.homeworkUpload.create({
      data: {
        userId: user.id,
        fileUrl: "inline://test-homework.txt",
        inputType: "text",
        status: "parsed",
        parseConfidence: 0.94,
        parserVersion: "test",
        parsedPayload: {
          assignmentTitle: "Reading response",
          assignmentSummary: "Work through one short-answer reading question.",
          questions: [
            {
              index: 1,
              promptText: "Explain why the student chose biology class.",
              questionType: "short_answer",
              focusSkill: "writing",
              studentGoal: "Explain the reason clearly and support it with detail.",
              answerFormat: "Write 2-3 clear sentences.",
              successCriteria: [
                "Answer the full question.",
                "Include one specific detail.",
              ],
              planSteps: [
                "Name the main reason first.",
                "Add one supporting detail from the text.",
              ],
              commonPitfalls: ["Giving only a one-word answer."],
            },
          ],
        },
      },
    });

    const session = await HomeworkHelpService.startSession(user.id, upload.id);

    const weakAttempt = await HomeworkHelpService.submitStep({
      sessionId: session.id,
      questionIndex: 0,
      studentAnswer: "Because science.",
      action: "submit",
      userId: user.id,
    });

    expect(weakAttempt.shouldAdvance).toBe(false);
    expect(weakAttempt.result).toBe("keep_working");

    const strongAttempt = await HomeworkHelpService.submitStep({
      sessionId: session.id,
      questionIndex: 0,
      studentAnswer:
        "The student chose biology class because the labs are hands-on and help her see the ideas in a real way. She also likes working with her group during experiments.",
      action: "submit",
      userId: user.id,
    });

    expect(strongAttempt.shouldAdvance).toBe(true);
    expect(strongAttempt.sessionCompleted).toBe(true);

    const refreshedSession = await prisma.homeworkHelpSession.findUniqueOrThrow({
      where: { id: session.id },
    });

    expect(refreshedSession.status).toBe("completed");
  }, 15000);

  it("completes the session when all questions are done, even out of order", async () => {
    const user = await prisma.user.create({
      data: {
        email: `homework-order-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
      },
    });

    const upload = await prisma.homeworkUpload.create({
      data: {
        userId: user.id,
        fileUrl: "inline://multi-homework.txt",
        inputType: "text",
        status: "parsed",
        parseConfidence: 0.95,
        parserVersion: "test",
        parsedPayload: {
          assignmentTitle: "History response",
          assignmentSummary: "Answer three questions about the reading.",
          contentShape: "multi_question",
          questions: [1, 2, 3].map((number) => ({
            index: number,
            promptText: `Explain detail ${number} from the passage.`,
            questionType: "short_answer",
            focusSkill: "writing",
            studentGoal: "Explain the idea clearly and support it.",
            answerFormat: "Write 2-3 sentences.",
            successCriteria: [
              "Answer the full question.",
              "Include one specific detail.",
            ],
            planSteps: [
              "State the idea first.",
              "Add one supporting detail from the passage.",
            ],
            commonPitfalls: ["Being too short."],
          })),
        },
      },
    });

    const session = await HomeworkHelpService.startSession(user.id, upload.id);
    const strongAnswer =
      "The reading shows the idea clearly, and one specific detail supports the explanation in a complete way for the whole class discussion.";

    const first = await HomeworkHelpService.submitStep({
      sessionId: session.id,
      questionIndex: 0,
      studentAnswer: strongAnswer,
      action: "submit",
      userId: user.id,
    });
    const third = await HomeworkHelpService.submitStep({
      sessionId: session.id,
      questionIndex: 2,
      studentAnswer: strongAnswer,
      action: "submit",
      userId: user.id,
    });
    const second = await HomeworkHelpService.submitStep({
      sessionId: session.id,
      questionIndex: 1,
      studentAnswer: strongAnswer,
      action: "submit",
      userId: user.id,
    });

    expect(first.sessionCompleted).toBe(false);
    expect(third.sessionCompleted).toBe(false);
    expect(second.sessionCompleted).toBe(true);

    const refreshedSession = await prisma.homeworkHelpSession.findUniqueOrThrow({
      where: { id: session.id },
    });

    expect(refreshedSession.status).toBe("completed");
  }, 15000);
});
