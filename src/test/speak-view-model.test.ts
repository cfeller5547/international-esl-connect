/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  buildSpeakLaunchViewModel,
  buildSpeakMissionPayload,
} from "@/features/speak/speak-view-model";

describe("speak view model", () => {
  it("builds the launch view model with an active topic", () => {
    const viewModel = buildSpeakLaunchViewModel({
      currentLevel: "intermediate",
      weakestSkill: "grammar",
      activeTopics: ["photosynthesis"],
      currentLearnTitle: "Continue Tell Stories Clearly",
      plan: "pro",
    });

    expect(viewModel.stats.streak).toBeGreaterThan(0);
    expect(viewModel.freeSpeechStarters.length).toBeGreaterThan(0);
    expect(viewModel.missions).toBeDefined();
    expect(viewModel.missions[0]?.recommendedInteractionMode).toBe("voice");
  });

  it("falls back to text mode for free tier", () => {
    const viewModel = buildSpeakLaunchViewModel({
      currentLevel: null,
      weakestSkill: null,
      activeTopics: ["preterite tense"],
      currentLearnTitle: null,
      plan: "free",
    });

    expect(viewModel.missions[0]?.recommendedInteractionMode).toBe("text");
  });

  it("builds mission payloads correctly for free speech", () => {
    const payload = buildSpeakMissionPayload(
      "free_speech",
      "today",
      {
        currentLevel: "intermediate",
        weakestSkill: "speaking",
        activeTopics: ["cell division"],
        currentLearnTitle: "Continue Tell Stories Clearly",
        plan: "pro",
      }
    );

    expect(payload.scenarioTitle).toBe("Free Speech");
    expect(payload.starterPrompt).toBeDefined();
  });

  it("builds mission payloads correctly for mission", () => {
    const payload = buildSpeakMissionPayload(
      "mission",
      "coffee_shop",
      {
        currentLevel: "advanced",
        weakestSkill: "vocabulary",
        activeTopics: ["cell division"],
        currentLearnTitle: "Continue Explain Opinions and Give Reasons",
        plan: "pro",
      }
    );

    expect(payload.scenarioTitle).toBe("The Coffee Shop Mix-Up");
    expect(payload.targetPhrases?.length).toBeGreaterThan(0);
  });
});
