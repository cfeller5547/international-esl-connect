/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  buildRecommendedSpeakMission,
  buildSpeakMission,
} from "@/features/speak/speak-view-model";

describe("speak view model", () => {
  it("prioritizes the latest weak skill while grounding the recommendation in a real topic", () => {
    const recommendation = buildRecommendedSpeakMission({
      currentLevel: "intermediate",
      weakestSkill: "grammar",
      activeTopics: ["photosynthesis"],
      currentLearnTitle: "Continue Tell Stories Clearly",
      plan: "pro",
    });

    expect(recommendation.scenarioKey).toBe("office_hours");
    expect(recommendation.title).toMatch(/photosynthesis/i);
    expect(recommendation.whyNow).toMatch(/grammar/i);
    expect(recommendation.mission.targetPhrases.length).toBeGreaterThan(0);
  });

  it("falls back to topic-driven free speech when there is no report yet", () => {
    const recommendation = buildRecommendedSpeakMission({
      currentLevel: null,
      weakestSkill: null,
      activeTopics: ["preterite tense"],
      currentLearnTitle: null,
      plan: "free",
    });

    expect(recommendation.mode).toBe("free_speech");
    expect(recommendation.starterKey).toBe("test_prep");
    expect(recommendation.recommendedInteractionMode).toBe("text");
    expect(recommendation.whyNow).toMatch(/preterite tense/i);
  });

  it("builds manual guided missions with level-aware phrases and a real opening question", () => {
    const mission = buildSpeakMission(
      {
        mode: "guided",
        scenarioKey: "presentation_practice",
      },
      {
        currentLevel: "advanced",
        weakestSkill: "vocabulary",
        activeTopics: ["cell division"],
        currentLearnTitle: "Continue Explain Opinions and Give Reasons",
        plan: "pro",
      }
    );

    expect(mission.mission.openingQuestion).toMatch(/cell division/i);
    expect(mission.mission.targetPhrases[0]).toBe("One reason is...");
    expect(mission.mission.recommendationReason).toMatch(/vocabulary/i);
  });
});
