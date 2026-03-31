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
    expect(gameView.game.ambientSet).toBe("hallway");
    expect(gameView.game.celebrationVariant).toBe("arcade_pulse");
    expect(gameView.game.summary.bridgeToSpeaking).toContain("speaking");
    expect(gameView.game.stages.map((stage) => stage.kind)).toEqual([
      "lane_runner",
      "reaction_pick",
      "voice_burst",
    ]);
    const reactionStage = gameView.game.stages[1];
    expect(gameView.game.stages[0]?.presentation?.layoutVariant).toBe("arcade_lane_runner");
    expect(gameView.game.stages[1]?.presentation?.layoutVariant).toBe("arcade_reaction_pick");
    expect(gameView.game.stages[2]?.presentation?.layoutVariant).toBe("voice_focus");
    expect(
      gameView.game.stages[0]?.kind === "lane_runner"
        ? gameView.game.stages[0].spriteRefs?.board ?? ""
        : ""
    ).toContain("name-tag-hallway-board");
    expect(reactionStage?.kind === "reaction_pick" ? reactionStage.spriteRefs?.neutral : null).toBeTruthy();
    expect(reactionStage?.kind === "reaction_pick" ? reactionStage.interactionModel : null).toBe(
      "target_tag"
    );
    expect(
      reactionStage?.kind === "reaction_pick"
        ? reactionStage.rounds[0]?.prompt
        : ""
    ).toContain("Hi, I'm Ana.");
    expect(
      gameView.game.stages[0]?.kind === "lane_runner"
        ? gameView.game.stages[0].targetSequenceIds
        : []
    ).toEqual(
      expect.arrayContaining(["token-hi", "token-ana", "token-brazil", "token-question"])
    );
    expect(gameView.game.stages).toHaveLength(3);
    expect(gameView.game.completionRule.requiredStageCount).toBe(3);
    expect(gameView.game.completionRule.maxRetriesPerStage).toBe(3);
  });

  it("evaluates lane-runner stages using the authored token sequence", async () => {
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
    const runnerStage = gameView.game.stages.find((stage) => stage.kind === "lane_runner");

    expect(runnerStage).toBeTruthy();

    const incorrect = await LearnGameService.evaluateAttempt({
      userId: user.id,
      unitSlug,
      stageId: runnerStage!.id,
      attemptNumber: 1,
      answer: {
        collectedIds:
          runnerStage!.kind === "lane_runner"
            ? ["token-hi", "token-ana", "token-age", "token-question"]
            : [],
        arcadeMetrics: {
          mistakeCount: 1,
          timeRemainingMs: 6400,
          comboPeak: 2,
          livesRemaining: 2,
          completionPath: "arcade",
        },
      },
    });

    expect(incorrect.outcome).toBe("practice_more");
    expect(incorrect.retryAllowed).toBe(true);
    expect(incorrect.resolvedInputMode).toBe(null);
    expect(incorrect.stageResult).toBe("retry");
    expect(incorrect.medal).toBe("retry");

    const correct = await LearnGameService.evaluateAttempt({
      userId: user.id,
      unitSlug,
      stageId: runnerStage!.id,
      attemptNumber: 2,
      answer: {
        collectedIds:
          runnerStage!.kind === "lane_runner" ? runnerStage!.targetSequenceIds : [],
        arcadeMetrics: {
          mistakeCount: 0,
          timeRemainingMs: 9200,
          comboPeak: 4,
          livesRemaining: 3,
          completionPath: "arcade",
        },
      },
    });

    expect(correct.outcome).toBe("strong");
    expect(correct.retryAllowed).toBe(false);
    expect(correct.resolvedInputMode).toBe(null);
    expect(correct.nearMiss).toBe(false);
    expect(correct.stageResult).toBe("cleared");
    expect(["gold", "silver", "bronze"]).toContain(correct.medal);
    expect(correct.scoreDelta).toBeGreaterThan(0);
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
    const voiceStage = gameView.game.stages.find((stage) => stage.kind === "voice_burst");

    expect(voiceStage).toBeTruthy();

    const incorrect = await LearnGameService.evaluateAttempt({
      userId: user.id,
      unitSlug,
      stageId: voiceStage!.id,
      inputMode: "fallback",
      attemptNumber: 1,
      answer: {
        fallbackOptionId: voiceStage!.fallbackOptions[1]?.id ?? "alt-1",
        arcadeMetrics: {
          mistakeCount: 1,
          timeRemainingMs: 4800,
          comboPeak: 1,
          livesRemaining: 2,
          completionPath: "fallback",
        },
      },
    });

    expect(incorrect.outcome).toBe("practice_more");
    expect(incorrect.retryAllowed).toBe(true);
    expect(incorrect.resolvedInputMode).toBe("fallback");
    expect(incorrect.nearMiss).toBe(false);

    const correct = await LearnGameService.evaluateAttempt({
      userId: user.id,
      unitSlug,
      stageId: voiceStage!.id,
      inputMode: "fallback",
      attemptNumber: 2,
      answer: {
        fallbackOptionId: voiceStage!.correctOptionId,
        arcadeMetrics: {
          mistakeCount: 0,
          timeRemainingMs: 7600,
          comboPeak: 2,
          livesRemaining: 3,
          completionPath: "fallback",
        },
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
              scoreDelta: correct.scoreDelta,
              combo: correct.combo,
              livesRemaining: correct.livesRemaining,
              stageResult: correct.stageResult,
              completionPath: correct.completionPath,
              medal: correct.medal,
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
