/** @vitest-environment node */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/prisma";
import { bootstrapDatabase } from "@/server/bootstrap-data";
import { CurriculumService } from "@/server/services/curriculum-service";
import { LearnGameService } from "@/server/services/learn-game-service";

async function unlockGameStep(userId: string, unitSlug: string) {
  await CurriculumService.completeUnitActivity({
    userId,
    unitSlug,
    activityType: "lesson",
    score: 100,
  });

  await CurriculumService.completeUnitActivity({
    userId,
    unitSlug,
    activityType: "practice",
    score: 100,
  });
}

describe("learn game service", () => {
  beforeAll(async () => {
    await bootstrapDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns the authored game payload for the current unit", async () => {
    const user = await prisma.user.create({
      data: {
        email: `learn-game-view-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
        currentLevel: "very_basic",
      },
    });

    const curriculum = await CurriculumService.getAssignedCurriculum(user.id);
    const unitSlug = curriculum.currentUnit!.slug;

    await unlockGameStep(user.id, unitSlug);

    const gameView = await LearnGameService.getGameView(user.id, unitSlug);

    expect(gameView.progressStatus).toBe("unlocked");
    expect(gameView.activity.activityType).toBe("game");
    expect(gameView.activity.href).toBe(`/app/learn/unit/${unitSlug}/game`);
    expect(gameView.game.gameTitle).toBe("Name Tag Mixer");
    expect(gameView.game.gameKind).toBe("name_tag_mixer");
    expect(gameView.game.summary.bridgeToSpeaking).toContain("speaking");
    expect(gameView.game.stages.map((stage) => stage.kind)).toEqual([
      "assemble",
      "choice",
      "voice_prompt",
    ]);
    expect(gameView.game.stages[0]?.presentation?.layoutVariant).toBe("slot_strip");
    expect(gameView.game.stages[1]?.presentation?.layoutVariant).toBe("dialogue_pick");
    expect(gameView.game.stages[2]?.presentation?.layoutVariant).toBe("voice_focus");
    expect(gameView.game.stages[1]?.presentation?.dialoguePrompt).toContain(
      "Hi, I'm Ana. I'm from Brazil."
    );
    expect(gameView.game.stages).toHaveLength(3);
    expect(gameView.game.completionRule.requiredStageCount).toBe(3);
    expect(gameView.game.completionRule.maxRetriesPerStage).toBe(1);
  });

  it("evaluates assemble stages using the authored slot assignments", async () => {
    const user = await prisma.user.create({
      data: {
        email: `learn-game-assemble-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
        currentLevel: "very_basic",
      },
    });

    const curriculum = await CurriculumService.getAssignedCurriculum(user.id);
    const unitSlug = curriculum.currentUnit!.slug;

    await unlockGameStep(user.id, unitSlug);

    const gameView = await LearnGameService.getGameView(user.id, unitSlug);
    const assembleStage = gameView.game.stages.find((stage) => stage.kind === "assemble");

    expect(assembleStage).toBeTruthy();

    const incorrect = await LearnGameService.evaluateAttempt({
      userId: user.id,
      unitSlug,
      stageId: assembleStage!.id,
      attemptNumber: 1,
      answer: {
        assembleAssignments: [
          { slotId: "greeting", optionId: "opt-hi" },
          { slotId: "name", optionId: "opt-ana" },
          { slotId: "country", optionId: "opt-age" },
          { slotId: "question", optionId: "opt-question" },
        ],
      },
    });

    expect(incorrect.outcome).toBe("practice_more");
    expect(incorrect.retryAllowed).toBe(true);
    expect(incorrect.resolvedInputMode).toBe(null);

    const correct = await LearnGameService.evaluateAttempt({
      userId: user.id,
      unitSlug,
      stageId: assembleStage!.id,
      attemptNumber: 2,
      answer: {
        assembleAssignments: [
          { slotId: "greeting", optionId: "opt-hi" },
          { slotId: "name", optionId: "opt-ana" },
          { slotId: "country", optionId: "opt-brazil" },
          { slotId: "question", optionId: "opt-question" },
        ],
      },
    });

    expect(correct.outcome).toBe("strong");
    expect(correct.retryAllowed).toBe(false);
    expect(correct.resolvedInputMode).toBe(null);
  });

  it("evaluates fallback answers and preserves canonical game review payloads", async () => {
    const user = await prisma.user.create({
      data: {
        email: `learn-game-eval-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
        currentLevel: "very_basic",
      },
    });

    const curriculum = await CurriculumService.getAssignedCurriculum(user.id);
    const unitSlug = curriculum.currentUnit!.slug;

    await unlockGameStep(user.id, unitSlug);

    const gameView = await LearnGameService.getGameView(user.id, unitSlug);
    const voiceStage = gameView.game.stages.find((stage) => stage.kind === "voice_prompt");

    expect(voiceStage).toBeTruthy();

    const incorrect = await LearnGameService.evaluateAttempt({
      userId: user.id,
      unitSlug,
      stageId: voiceStage!.id,
      inputMode: "fallback",
      attemptNumber: 1,
      answer: {
        fallbackOptionId: voiceStage!.fallbackOptions[1]?.id ?? "alt-1",
      },
    });

    expect(incorrect.outcome).toBe("practice_more");
    expect(incorrect.retryAllowed).toBe(true);
    expect(incorrect.resolvedInputMode).toBe("fallback");

    const correct = await LearnGameService.evaluateAttempt({
      userId: user.id,
      unitSlug,
      stageId: voiceStage!.id,
      inputMode: "fallback",
      attemptNumber: 2,
      answer: {
        fallbackOptionId: voiceStage!.correctOptionId,
      },
    });

    expect(correct.outcome).toBe("strong");
    expect(correct.retryAllowed).toBe(false);
    expect(correct.resolvedInputMode).toBe("fallback");

    await CurriculumService.completeUnitActivity({
      userId: user.id,
      unitSlug,
      activityType: "game",
      score: 100,
      responsePayload: {
        gameReview: {
          gameId: gameView.game.gameId,
          gameTitle: gameView.game.gameTitle,
          gameKind: gameView.game.gameKind,
          strength: "You kept the challenge moving.",
          nextFocus: "Carry the same clarity into speaking.",
          bridgeToSpeaking: "Use the same opener when the speaking step starts.",
          replayStageIds: [voiceStage!.id],
          stages: [
            {
              stageId: voiceStage!.id,
              stageKind: voiceStage!.kind,
              stageTitle: voiceStage!.title,
              outcome: "strong",
              coachNote: "Carry the same clarity into speaking.",
              transcriptText: null,
              resolvedInputMode: "fallback",
            },
          ],
        },
      },
    });

    const refreshed = await LearnGameService.getGameView(user.id, unitSlug);

    expect(refreshed.progressStatus).toBe("completed");
    expect(refreshed.savedReview?.gameTitle).toBe("Name Tag Mixer");
    expect(refreshed.savedReview?.stages[0]?.stageId).toBe(voiceStage!.id);
    expect(refreshed.savedReview?.stages[0]?.resolvedInputMode).toBe("fallback");
  });
});
