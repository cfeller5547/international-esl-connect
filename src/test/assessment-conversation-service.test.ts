/** @vitest-environment node */

import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/prisma";
import { AssessmentConversationService } from "@/server/services/assessment-conversation-service";

describe("assessment conversation service", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("starts with the authored introduction and returns a natural follow-up for guest onboarding", async () => {
    const guestSession = await prisma.guestOnboardingSession.create({
      data: {
        sessionToken: `guest-${crypto.randomUUID()}`,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        guestSessionId: guestSession.id,
        context: "onboarding_full",
        status: "in_progress",
      },
    });

    expect(AssessmentConversationService.createOpeningTurn()).toBe(
      "Hi, I'm Maya. I want to get a feel for how you use English in class. What's your name, and what class are you taking right now?"
    );

    const reply = await AssessmentConversationService.submitTurn({
      assessmentAttemptId: attempt.id,
      guestSessionToken: guestSession.sessionToken,
      transcript: [
        {
          speaker: "ai",
          text: AssessmentConversationService.createOpeningTurn(),
        },
      ],
      studentInput: {
        text: "Hi, I'm Ana, and I'm taking biology right now.",
        voiceCaptured: true,
      },
    });

    expect(reply.studentTranscriptText).toBe("Hi, I'm Ana, and I'm taking biology right now.");
    expect(reply.aiResponseText).toMatch(/class|understand|more/i);
    expect(reply.canAdvance).toBe(false);
  });

  it("closes warmly after the final required reply", async () => {
    const user = await prisma.user.create({
      data: {
        email: `assessment-conversation-${crypto.randomUUID()}@example.com`,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
      },
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        userId: user.id,
        context: "onboarding_full",
        status: "in_progress",
      },
    });

    const transcript = [
      {
        speaker: "ai" as const,
        text: AssessmentConversationService.createOpeningTurn(),
      },
      {
        speaker: "student" as const,
        text: "Hi, I'm Ana, and I'm taking biology right now.",
      },
      {
        speaker: "ai" as const,
        text: "Nice to meet you, Ana. What do you usually do in that class?",
      },
      {
        speaker: "student" as const,
        text: "We read short texts and talk about them in groups.",
      },
      {
        speaker: "ai" as const,
        text: "What part of English feels easiest for you right now, and what still feels hard?",
      },
      {
        speaker: "student" as const,
        text: "Reading is easier for me, but speaking in class is still hard sometimes.",
      },
      {
        speaker: "ai" as const,
        text: "If you need help in class, how do you usually ask for it?",
      },
    ];

    const reply = await AssessmentConversationService.submitTurn({
      assessmentAttemptId: attempt.id,
      userId: user.id,
      transcript,
      studentInput: {
        text: "I usually ask my teacher to explain one more time and give me an example.",
        audioDataUrl: "data:audio/webm;base64,AA==",
        audioMimeType: "audio/webm",
      },
    });

    expect(reply.canAdvance).toBe(true);
    expect(reply.replyCount).toBe(4);
    expect(reply.aiResponseText).toMatch(/clear picture|understand your english/i);
  });

  it("rephrases instead of counting a clarification like 'why'", async () => {
    const guestSession = await prisma.guestOnboardingSession.create({
      data: {
        sessionToken: `guest-${crypto.randomUUID()}`,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        guestSessionId: guestSession.id,
        context: "onboarding_full",
        status: "in_progress",
      },
    });

    const reply = await AssessmentConversationService.submitTurn({
      assessmentAttemptId: attempt.id,
      guestSessionToken: guestSession.sessionToken,
      transcript: [
        {
          speaker: "ai",
          text: AssessmentConversationService.createOpeningTurn(),
        },
        {
          speaker: "student",
          text: "Hi, I'm Ana, and I'm taking biology right now.",
          countsTowardProgress: true,
        },
        {
          speaker: "ai",
          text: "Nice to meet you, Ana. What do you usually do in your biology class?",
        },
        {
          speaker: "student",
          text: "We read short texts and talk about them in groups.",
          countsTowardProgress: true,
        },
        {
          speaker: "ai",
          text: "That sounds interesting! Which part of biology do you enjoy the most?",
        },
      ],
      studentInput: {
        text: "why",
        voiceCaptured: true,
      },
    });

    expect(reply.countsTowardProgress).toBe(false);
    expect(reply.replyCount).toBe(2);
    expect(reply.canAdvance).toBe(false);
    expect(reply.aiResponseText).toMatch(/which part of class do you like best|what activities/i);
  });

  it("accepts live mic transcripts flagged as voice without requiring an uploaded audio blob", async () => {
    const guestSession = await prisma.guestOnboardingSession.create({
      data: {
        sessionToken: `guest-${crypto.randomUUID()}`,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        guestSessionId: guestSession.id,
        context: "onboarding_full",
        status: "in_progress",
      },
    });

    const reply = await AssessmentConversationService.submitTurn({
      assessmentAttemptId: attempt.id,
      guestSessionToken: guestSession.sessionToken,
      transcript: [
        {
          speaker: "ai",
          text: AssessmentConversationService.createOpeningTurn(),
        },
      ],
      studentInput: {
        text: "Hi, I'm Luis, and I'm taking history this semester.",
        voiceCaptured: true,
        durationSeconds: 3,
      },
    });

    expect(reply.studentTranscriptText).toBe(
      "Hi, I'm Luis, and I'm taking history this semester."
    );
    expect(reply.durationSeconds).toBe(3);
    expect(reply.canAdvance).toBe(false);
  });
});
