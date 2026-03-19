/** @vitest-environment node */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapDatabase } from "@/server/bootstrap-data";
import { prisma } from "@/server/prisma";
import { ConversationService } from "@/server/services/conversation-service";

describe("conversation service realtime support", () => {
  beforeAll(async () => {
    await bootstrapDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("supports unseeded live sessions and transcript syncing before completion", async () => {
    const user = await prisma.user.create({
      data: {
        email: `speak-realtime-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
      },
    });

    const started = await ConversationService.startSession({
      userId: user.id,
      mode: "guided",
      interactionMode: "text",
      surface: "speak",
      missionKind: "guided",
      scenarioKey: "class_discussion",
      seedOpeningTurn: false,
      summaryPayload: {
        scenarioTitle: "Class discussion",
        scenarioSetup: "Discuss an idea from class and explain your opinion.",
        followUpPrompts: ["Give one example."],
      },
    });

    const initial = await ConversationService.getSession(started.sessionId, user.id);
    expect(initial?.turns).toHaveLength(0);

    const sync = await ConversationService.syncRealtimeTranscript({
      sessionId: started.sessionId,
      userId: user.id,
      turns: [
        {
          speaker: "ai",
          text: "Hi. Tell me one idea you discussed in class this week.",
        },
        {
          speaker: "student",
          text: "We talked about pollution and how it affects our neighborhood.",
        },
        {
          speaker: "ai",
          text: "That is a clear start. What example from your area shows that problem?",
        },
      ],
    });

    expect(sync.studentCoachings).toHaveLength(1);
    expect(sync.studentCoachings[0]?.coachLabel).toBeTruthy();
    expect(sync.studentCoachings[0]?.microCoaching).toBeTruthy();

    const synced = await ConversationService.getSession(started.sessionId, user.id);
    expect(
      synced?.turns.map((turn) => ({
        speaker: turn.speaker,
        text: turn.transcriptText,
      }))
    ).toEqual([
      {
        speaker: "ai",
        text: "Hi. Tell me one idea you discussed in class this week.",
      },
      {
        speaker: "student",
        text: "We talked about pollution and how it affects our neighborhood.",
      },
      {
        speaker: "ai",
        text: "That is a clear start. What example from your area shows that problem?",
      },
    ]);
    expect(
      (synced?.turns.find((turn) => turn.speaker === "student")?.metricsPayload as {
        microCoaching?: string;
        coachLabel?: string;
      })?.coachLabel
    ).toBeTruthy();

    const completion = await ConversationService.completeSession({
      sessionId: started.sessionId,
      userId: user.id,
      durationSecondsOverride: 97,
    });

    expect(completion.durationSeconds).toBe(97);
    expect(completion.studentTurnCount).toBe(1);
    expect(completion.review.score).toBeGreaterThan(0);
  });

  it("serializes overlapping realtime transcript syncs for the same session", async () => {
    const user = await prisma.user.create({
      data: {
        email: `speak-realtime-lock-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
      },
    });

    const started = await ConversationService.startSession({
      userId: user.id,
      mode: "guided",
      interactionMode: "text",
      surface: "speak",
      missionKind: "guided",
      scenarioKey: "class_discussion",
      seedOpeningTurn: false,
      summaryPayload: {
        scenarioTitle: "Class discussion",
        scenarioSetup: "Discuss one idea from class and give a concrete example.",
        followUpPrompts: ["Give one detail from your class."],
      },
    });

    const turns = [
      {
        speaker: "ai" as const,
        text: "Tell me one idea your class discussed this week.",
      },
      {
        speaker: "student" as const,
        text: "We discussed pollution and how it affects our city.",
      },
      {
        speaker: "ai" as const,
        text: "What example from your neighborhood shows that problem?",
      },
      {
        speaker: "student" as const,
        text: "There is too much trash near the bus stop after school.",
      },
    ];

    await Promise.all(
      Array.from({ length: 4 }, () =>
        ConversationService.syncRealtimeTranscript({
          sessionId: started.sessionId,
          userId: user.id,
          turns,
        })
      )
    );

    const synced = await ConversationService.getSession(started.sessionId, user.id);
    expect(
      synced?.turns.map((turn) => ({
        speaker: turn.speaker,
        text: turn.transcriptText,
      }))
    ).toEqual(turns);
  });

  it("suppresses vocab-only visible coaching in free-speech realtime sync", async () => {
    const user = await prisma.user.create({
      data: {
        email: `speak-realtime-free-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
      },
    });

    const started = await ConversationService.startSession({
      userId: user.id,
      mode: "free_speech",
      interactionMode: "text",
      surface: "speak",
      missionKind: "free_speech",
      scenarioKey: "learning",
      seedOpeningTurn: false,
      summaryPayload: {
        starterKey: "learning",
        starterLabel: "Something I'm learning",
        scenarioTitle: "Something I'm learning",
        scenarioSetup: "Have an open conversation about something the learner is studying.",
        targetPhrases: ["I'm learning...", "One part that stands out is..."],
        followUpPrompts: ["Ask what part feels easiest right now."],
      },
    });

    const sync = await ConversationService.syncRealtimeTranscript({
      sessionId: started.sessionId,
      userId: user.id,
      turns: [
        {
          speaker: "ai",
          text: "What are you learning right now?",
        },
        {
          speaker: "student",
          text: "We are learning about plants and cells in science today.",
        },
      ],
    });

    expect(sync.studentCoachings).toHaveLength(0);

    const synced = await ConversationService.getSession(started.sessionId, user.id);
    expect(
      (synced?.turns.find((turn) => turn.speaker === "student")?.metricsPayload as {
        microCoaching?: string | null;
      })?.microCoaching ?? null
    ).toBeNull();
  });
});
