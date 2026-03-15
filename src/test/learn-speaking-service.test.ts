/** @vitest-environment node */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/prisma";
import { bootstrapDatabase } from "@/server/bootstrap-data";
import { CurriculumService } from "@/server/services/curriculum-service";
import { LearnSpeakingService } from "@/server/services/learn-speaking-service";

async function unlockSpeakingStep(userId: string, unitSlug: string) {
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

describe("learn speaking service", () => {
  beforeAll(async () => {
    await bootstrapDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("runs a text-first speaking mission and returns a focused review", async () => {
    const user = await prisma.user.create({
      data: {
        email: `learn-speaking-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
        currentLevel: "basic",
        fullDiagnosticCompletedAt: new Date(),
      },
    });

    const curriculum = await CurriculumService.getAssignedCurriculum(user.id);
    const unitSlug = curriculum.currentUnit?.slug;
    expect(unitSlug).toBeTruthy();

    await unlockSpeakingStep(user.id, unitSlug!);

    const missionView = await LearnSpeakingService.getMissionView(user.id, unitSlug!);
    expect(missionView.plan).toBe("free");
    expect(missionView.mission.isBenchmark).toBe(false);

    const started = await LearnSpeakingService.startMission({
      userId: user.id,
      unitSlug: unitSlug!,
      interactionMode: "text",
    });

    expect(started.deliveryMode).toBe("text_chat");
    expect(started.openingTurn).not.toMatch(/let's practice/i);
    expect(started.resumeState.turns[0]?.speaker).toBe("ai");

    await LearnSpeakingService.submitTurn({
      userId: user.id,
      sessionId: started.sessionId,
      studentInput: {
        text: "I usually wake up at six thirty and get ready for school.",
      },
    });
    await LearnSpeakingService.submitTurn({
      userId: user.id,
      sessionId: started.sessionId,
      studentInput: {
        text: "After breakfast I review my homework and then I take the bus.",
      },
    });
    await LearnSpeakingService.submitTurn({
      userId: user.id,
      sessionId: started.sessionId,
      studentInput: {
        text: "In the evening I finish my work because I have class early the next day.",
      },
    });

    const review = await LearnSpeakingService.completeMission({
      userId: user.id,
      unitSlug: unitSlug!,
      sessionId: started.sessionId,
    });

    expect(review.score).toBeGreaterThan(0);
    expect(review.highlights.length).toBeGreaterThan(0);
    expect(review.turns.some((turn) => turn.speaker === "student")).toBe(true);

    await CurriculumService.completeUnitActivity({
      userId: user.id,
      unitSlug: unitSlug!,
      activityType: "speaking",
      score: review.score,
      responsePayload: {
        sessionId: started.sessionId,
        interactionMode: "text",
        missionReview: review,
      },
    });

    const updated = await CurriculumService.getAssignedCurriculum(user.id);
    expect(updated.currentActivity?.activityType).toBe("writing");
  });

  it("marks the third unit speaking mission as a benchmark", async () => {
    const user = await prisma.user.create({
      data: {
        email: `learn-speaking-benchmark-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
        currentLevel: "very_basic",
      },
    });

    let curriculum = await CurriculumService.getAssignedCurriculum(user.id);

    for (let completedUnits = 0; completedUnits < 2; completedUnits += 1) {
      const unitSlug = curriculum.currentUnit?.slug;
      expect(unitSlug).toBeTruthy();

      for (const activity of ["lesson", "practice", "speaking", "writing", "checkpoint"] as const) {
        await CurriculumService.completeUnitActivity({
          userId: user.id,
          unitSlug: unitSlug!,
          activityType: activity,
          score: 90,
          responsePayload:
            activity === "speaking" || activity === "writing"
              ? { answer: "A complete enough sample response for automated testing." }
              : activity === "checkpoint"
                ? { answers: { 0: "0", 1: "0" } }
                : undefined,
        });
      }

      curriculum = await CurriculumService.getAssignedCurriculum(user.id);
    }

    await unlockSpeakingStep(user.id, curriculum.currentUnit!.slug);

    const missionView = await LearnSpeakingService.getMissionView(
      user.id,
      curriculum.currentUnit!.slug
    );

    expect(missionView.unit.orderIndex).toBe(3);
    expect(missionView.mission.isBenchmark).toBe(true);
  });

  it("supports Learn realtime transcript syncing for voice sessions", async () => {
    const user = await prisma.user.create({
      data: {
        email: `learn-speaking-realtime-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
        currentLevel: "basic",
      },
    });

    const curriculum = await CurriculumService.getAssignedCurriculum(user.id);
    const unitSlug = curriculum.currentUnit!.slug;

    await unlockSpeakingStep(user.id, unitSlug);

    const { unit, activity } = await CurriculumService.getUnitActivity(
      user.id,
      unitSlug,
      "speaking"
    );

    const session = await prisma.speakSession.create({
      data: {
        userId: user.id,
        mode: "guided",
        surface: "learn",
        missionKind: "unit_speaking",
        interactionMode: "voice",
        status: "active",
        curriculumUnitId: unit.id,
        curriculumActivityId: activity.id,
        summaryPayload: {
          unitSlug,
          scenarioTitle: "Explain Opinions and Give Reasons",
          scenarioSetup: "You are answering a discussion question in class.",
          counterpartRole: "teacher",
          openingQuestion: "What do you think, and why?",
          followUpPrompts: ["Why do you think that?", "Can you give one example?"],
        } as never,
      },
    });

    await prisma.speakTurn.create({
      data: {
        speakSessionId: session.id,
        speaker: "ai",
        turnIndex: 1,
        transcriptText: "What do you think, and why?",
      },
    });

    const sync = await LearnSpeakingService.syncRealtimeTranscript({
      userId: user.id,
      sessionId: session.id,
      turns: [
        { speaker: "ai", text: "What do you think, and why?" },
        { speaker: "student", text: "I think uniforms can help because students feel equal." },
        { speaker: "ai", text: "That makes sense. Can you give one example?" },
        { speaker: "student", text: "For example, students do not compare clothes as much." },
        { speaker: "ai", text: "Good. What is one drawback?" },
        { speaker: "student", text: "Some students feel they cannot show their style." },
      ],
    });

    expect(sync.studentTurnCount).toBe(3);
    expect(sync.canFinish).toBe(true);

    const review = await LearnSpeakingService.completeMission({
      userId: user.id,
      unitSlug,
      sessionId: session.id,
    });

    expect(review.score).toBeGreaterThan(0);
    expect(review.highlights.length).toBeGreaterThan(0);
  });

  it("repairs a stale generic opening turn before the learner replies", async () => {
    const user = await prisma.user.create({
      data: {
        email: `learn-speaking-repair-${crypto.randomUUID()}@example.com`,
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

    await unlockSpeakingStep(user.id, unitSlug);

    const { unit, activity } = await CurriculumService.getUnitActivity(
      user.id,
      unitSlug,
      "speaking"
    );

    const session = await prisma.speakSession.create({
      data: {
        userId: user.id,
        mode: "guided",
        surface: "learn",
        missionKind: "unit_speaking",
        interactionMode: "text",
        status: "active",
        curriculumUnitId: unit.id,
        curriculumActivityId: activity.id,
        summaryPayload: {
          unitSlug,
          scenarioTitle: unit.title,
          scenarioSetup: "You meet a new student before class starts.",
          counterpartRole: "classmate",
          openingQuestion: "Can you answer that in your own words?",
          canDoStatement: unit.canDoStatement,
          performanceTask: unit.performanceTask,
        } as never,
      },
    });

    await prisma.speakTurn.create({
      data: {
        speakSessionId: session.id,
        speaker: "ai",
        turnIndex: 1,
        transcriptText: "Can you answer that in your own words?",
      },
    });

    const missionView = await LearnSpeakingService.getMissionView(user.id, unitSlug);

    expect(missionView.session?.turns[0]?.text).toBe(
      "Hi, I don't think we've met yet. What's your name?"
    );

    const persistedTurn = await prisma.speakTurn.findFirstOrThrow({
      where: {
        speakSessionId: session.id,
        turnIndex: 1,
      },
    });

    expect(persistedTurn.transcriptText).toBe(
      "Hi, I don't think we've met yet. What's your name?"
    );
  });
});
