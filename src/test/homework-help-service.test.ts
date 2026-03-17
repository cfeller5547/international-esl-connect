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
  });
});
