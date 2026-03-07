import { describe, expect, it } from "vitest";

import {
  calculateOverallScore,
  getLevelLabel,
  scoreAssessment,
} from "@/server/ai/heuristics";

describe("assessment heuristics", () => {
  it("calculates the overall score as the rounded mean of six skills", () => {
    const overall = calculateOverallScore({
      listening: 70,
      speaking: 58,
      reading: 66,
      writing: 55,
      vocabulary: 68,
      grammar: 61,
    });

    expect(overall).toBe(63);
  });

  it("maps level labels to the documented score bands", () => {
    expect(getLevelLabel(25)).toBe("very_basic");
    expect(getLevelLabel(50)).toBe("basic");
    expect(getLevelLabel(75)).toBe("intermediate");
    expect(getLevelLabel(88)).toBe("advanced");
  });

  it("returns six skill scores and a valid report payload", () => {
    const result = scoreAssessment({
      objectiveAnswers: [
        {
          questionId: "1",
          value: "correct",
          correctValue: "correct",
          skill: "reading",
        },
        {
          questionId: "2",
          value: "correct",
          correctValue: "correct",
          skill: "grammar",
        },
        {
          questionId: "3",
          value: "correct",
          correctValue: "correct",
          skill: "vocabulary",
        },
      ],
      conversationTurns: [
        {
          prompt: "Tell me about class.",
          answer: "I reviewed vocabulary and explained one reading strategy.",
        },
        {
          prompt: "What was difficult?",
          answer: "I need more confidence when I speak for a longer time.",
        },
      ],
      writingSample:
        "This week I explained a passage with evidence and wrote a short summary.",
    });

    expect(result.skills).toHaveLength(6);
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.levelLabel).toMatch(/very_basic|basic|intermediate|advanced/);
  });
});
