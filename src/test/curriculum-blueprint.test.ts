/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { CURRICULUM_BLUEPRINTS } from "@/server/curriculum-blueprint";
import { AUTHORED_SPEAKING_MISSIONS } from "@/server/curriculum-speaking-missions";
import { isGenericLearnOpeningQuestion } from "@/server/learn-speaking-prompts";

describe("curriculum blueprint speaking missions", () => {
  it("authors speaking mission content for every unit", () => {
    const allUnits = CURRICULUM_BLUEPRINTS.flatMap((curriculum) => curriculum.units);

    expect(Object.keys(AUTHORED_SPEAKING_MISSIONS).sort()).toEqual(
      allUnits.map((unit) => unit.slug).sort()
    );
  });

  it("uses concrete, non-generic speaking mission scaffolding across all units", () => {
    const allUnits = CURRICULUM_BLUEPRINTS.flatMap((curriculum) => curriculum.units);

    for (const unit of allUnits) {
      expect(unit.speakingMission.scenarioTitle.trim().length).toBeGreaterThan(8);
      expect(unit.speakingMission.scenarioSetup.trim().length).toBeGreaterThan(24);
      expect(isGenericLearnOpeningQuestion(unit.speakingMission.openingQuestion)).toBe(false);
      expect(unit.speakingMission.targetPhrases.length).toBeGreaterThanOrEqual(3);
      expect(
        unit.speakingMission.targetPhrases.filter((phrase) => /\s/.test(phrase)).length
      ).toBeGreaterThanOrEqual(3);
      expect(unit.speakingMission.modelExample).not.toBe(unit.performanceTask);
      expect(unit.speakingMission.modelExample.trim().length).toBeGreaterThan(40);
      expect(unit.speakingMission.followUpPrompts.length).toBeGreaterThanOrEqual(3);

      for (const followUp of unit.speakingMission.followUpPrompts) {
        expect(followUp).not.toMatch(/^respond to this scenario:/i);
        expect(followUp).not.toMatch(/^add one useful detail/i);
        expect(followUp).not.toMatch(/^finish by showing/i);
      }
    }
  });
});
