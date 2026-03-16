/** @vitest-environment node */

import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/prisma";
import { AssessmentService } from "@/server/services/assessment-service";

describe("assessment service", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("carries completed quick-baseline objective answers into the full diagnostic bootstrap", async () => {
    const user = await prisma.user.create({
      data: {
        email: `assessment-bootstrap-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
      },
    });

    await prisma.assessmentAttempt.create({
      data: {
        userId: user.id,
        context: "onboarding_quick",
        status: "completed",
        completedAt: new Date(),
        responsesPayload: {
          objectiveAnswers: [
            {
              questionId: "quick-reading-1",
              value: "1",
              correctValue: "1",
              skill: "reading",
            },
            {
              questionId: "quick-grammar-1",
              value: "1",
              correctValue: "1",
              skill: "grammar",
            },
          ],
          conversationTurns: [
            {
              prompt: "Tell me one thing you studied this week.",
              answer: "I studied reading and grammar.",
            },
          ],
        } as never,
      },
    });

    const bootstrap = await AssessmentService.getFullDiagnosticBootstrap({
      userId: user.id,
      reusableQuestionIds: ["quick-reading-1", "quick-grammar-1", "full-reading-2"],
    });

    expect(bootstrap.importedObjectiveCount).toBe(2);
    expect(bootstrap.initialState.answers).toEqual({
      "quick-reading-1": "1",
      "quick-grammar-1": "1",
    });
    expect(bootstrap.initialState.conversation).toEqual({});
    expect(bootstrap.initialState.writingSample).toBe("");
  });
});
