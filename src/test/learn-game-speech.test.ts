import { describe, expect, it } from "vitest";

import {
  getGamePreviewSpeechText,
  getStageResolvedSpeechText,
} from "@/lib/learn-game-speech";
import type {
  GameActivityPayload,
  LaneRunnerGameStage,
  VoiceBurstGameStage,
} from "@/server/learn-game-types";

describe("learn game speech helpers", () => {
  it("prefers authored resolved speech text for stage-clear playback", () => {
    const stage = {
      id: "runner-stage",
      kind: "lane_runner",
      title: "Hallway dash",
      prompt: "Collect the intro pieces.",
      lanes: [],
      tokens: [],
      targetSequenceIds: [],
      correctMessage: "Good.",
      retryMessage: "Try again.",
      timerMs: 18000,
      lives: 2,
      scoreRules: { correct: 120, miss: 40, streakBonus: 18, clearBonus: 150 },
      comboRules: { maxCombo: 4 },
      hudVariant: "lane_runner",
      interactionModel: "cross_dash",
      soundSet: "hallway",
      failWindowMs: 760,
      presentation: {
        layoutVariant: "arcade_lane_runner",
        resolvedSpeechText: "Hi, I'm Ana. I'm from Brazil. What about you?",
      },
    } as unknown as LaneRunnerGameStage;

    expect(getStageResolvedSpeechText(stage)).toBe(
      "Hi, I'm Ana. I'm from Brazil. What about you?"
    );
  });

  it("falls back to lane-runner target order when no authored speech text exists", () => {
    const stage = {
      id: "runner-stage",
      kind: "lane_runner",
      title: "Hallway dash",
      prompt: "Collect the intro pieces.",
      lanes: [],
      tokens: [
        { id: "hi", label: "Hi", lane: 0, role: "target" },
        { id: "name", label: "I'm Ana.", lane: 1, role: "target" },
        { id: "country", label: "I'm from Brazil.", lane: 2, role: "target" },
      ],
      targetSequenceIds: ["hi", "name", "country"],
      correctMessage: "Good.",
      retryMessage: "Try again.",
      timerMs: 18000,
      lives: 2,
      scoreRules: { correct: 120, miss: 40, streakBonus: 18, clearBonus: 150 },
      comboRules: { maxCombo: 4 },
      hudVariant: "lane_runner",
      interactionModel: "cross_dash",
      soundSet: "hallway",
      failWindowMs: 760,
      presentation: {
        layoutVariant: "arcade_lane_runner",
      },
    } as unknown as LaneRunnerGameStage;

    expect(getStageResolvedSpeechText(stage)).toBe("Hi I'm Ana. I'm from Brazil.");
  });

  it("uses the target phrase for voice stages and as the game preview fallback", () => {
    const voiceStage = {
      id: "voice-stage",
      kind: "voice_burst",
      title: "Intro burst",
      prompt: "Say the full line.",
      targetPhrase: "Hi, I'm Ana from Brazil. What about you?",
      coachFocus: "Keep the intro short and natural.",
      fallbackOptions: [],
      correctOptionId: "correct",
      correctMessage: "Good.",
      retryMessage: "Try again.",
      timerMs: 12000,
      lives: 2,
      scoreRules: { correct: 120, miss: 40, streakBonus: 18, clearBonus: 150 },
      comboRules: { maxCombo: 3 },
      hudVariant: "voice_burst",
      interactionModel: "burst_callout",
      soundSet: "hallway",
      failWindowMs: 1200,
      presentation: {
        layoutVariant: "voice_focus",
      },
    } as unknown as VoiceBurstGameStage;

    const game = {
      gameId: "game-1",
      gameTitle: "Name Tag Mixer",
      gameKind: "name_tag_mixer",
      layoutVariant: "game_shell",
      introText: "Practice introductions.",
      stages: [voiceStage],
      summary: {
        strength: "Strong opener.",
        nextFocus: "Keep it natural.",
        bridgeToSpeaking: "Use it in speaking.",
      },
      completionRule: {
        requiredStageCount: 1,
        maxRetriesPerStage: 3,
      },
      assetRefs: {},
      theme: "ocean",
    } as unknown as GameActivityPayload;

    expect(getStageResolvedSpeechText(voiceStage)).toBe(
      "Hi, I'm Ana from Brazil. What about you?"
    );
    expect(getGamePreviewSpeechText(game)).toBe(
      "Hi, I'm Ana from Brazil. What about you?"
    );
  });
});
