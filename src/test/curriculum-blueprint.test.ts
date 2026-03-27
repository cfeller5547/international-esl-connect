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

describe("curriculum blueprint game scaffolding", () => {
  const stage1Curricula = CURRICULUM_BLUEPRINTS.filter(
    (entry) => entry.level === "very_basic" || entry.level === "basic"
  );
  const voiceGameSlugs = new Set([
    "introductions-and-personal-information",
    "family-friends-and-classroom-language",
    "food-shopping-and-likes-dislikes",
    "habits-and-routines-in-more-detail",
    "past-events-and-weekend-stories",
    "health-travel-and-everyday-services",
    "comparing-choosing-and-short-narratives",
  ]);

  it("keeps Stage 1 game payloads authored instead of falling back to the generic template", () => {
    for (const curriculum of stage1Curricula) {
      for (const [index, unit] of curriculum.units.entries()) {
        expect(unit.game.gameId).toBe(`${curriculum.level}-${index + 1}-game`);
        expect(unit.game.gameTitle).not.toBe("Unit Game");
        expect(unit.game.gameKind).not.toBe("unit_challenge");
        expect(unit.game.theme).toBeTruthy();
        expect(unit.game.layoutVariant).not.toBe("generic");
        expect(unit.game.assetRefs.hero).toBeTruthy();
        expect(unit.game.summary.strength.trim().length).toBeGreaterThan(16);
        expect(unit.game.summary.nextFocus.trim().length).toBeGreaterThan(16);
        expect(unit.game.summary.bridgeToSpeaking.trim().length).toBeGreaterThan(16);
        expect(unit.game.stages).toHaveLength(3);
        expect(unit.game.completionRule.requiredStageCount).toBe(3);
        expect(unit.game.completionRule.maxRetriesPerStage).toBe(1);
        expect(
          unit.game.stages.every(
            (stage) => stage.title.trim().length > 0 && stage.prompt.trim().length > 0
          )
        ).toBe(true);
        const voiceStageCount = unit.game.stages.filter(
          (stage) => stage.kind === "voice_prompt"
        ).length;
        expect(voiceStageCount).toBe(voiceGameSlugs.has(unit.slug) ? 1 : 0);
        expect(unit.game.stages.some((stage) => stage.kind !== "choice")).toBe(true);
        expect(
          unit.game.stages.every((stage) => {
            expect(stage.presentation?.layoutVariant).toBeTruthy();

            return true;
          })
        ).toBe(true);
      }
    }
  });

  it("exercises the richer Stage 3 mechanics across the current 12 games", () => {
    const stageKinds = new Set(
      stage1Curricula.flatMap((curriculum) =>
        curriculum.units.flatMap((unit) => unit.game.stages.map((stage) => stage.kind))
      )
    );

    expect(stageKinds.has("assemble")).toBe(true);
    expect(stageKinds.has("spotlight")).toBe(true);
    expect(stageKinds.has("state_switch")).toBe(true);
    expect(stageKinds.has("priority_board")).toBe(true);
  });

  it("authors Name Tag Mixer with the denser Stage 4 layout variants", () => {
    const introUnit = stage1Curricula
      .flatMap((curriculum) => curriculum.units)
      .find((unit) => unit.slug === "introductions-and-personal-information");

    expect(introUnit).toBeTruthy();
    expect(introUnit!.game.gameTitle).toBe("Name Tag Mixer");
    expect(introUnit!.game.stages[0]?.presentation?.layoutVariant).toBe("slot_strip");
    expect(introUnit!.game.stages[1]?.presentation?.layoutVariant).toBe("dialogue_pick");
    expect(introUnit!.game.stages[2]?.presentation?.layoutVariant).toBe("voice_focus");
    expect(introUnit!.game.stages[1]?.presentation?.dialoguePrompt).toContain(
      "Hi, I'm Ana. I'm from Brazil."
    );
  });

  it("exposes stage-one theme and layout metadata on every authored game", () => {
    for (const curriculum of stage1Curricula) {
      for (const unit of curriculum.units) {
        expect(unit.game.theme).toBeTruthy();
        expect(unit.game.layoutVariant).toBeTruthy();
        expect(unit.game.assetRefs.hero).toBeTruthy();

        if (unit.slug === "home-school-and-neighborhood") {
          expect(unit.game.layoutVariant).toBe("map_route");
        }

        if (unit.slug === "what-is-happening-now") {
          expect(unit.game.layoutVariant).toBe("scene_hotspots");
        }
      }
    }
  });

  it("authors Map Route with positioned nodes and explicit route connections", () => {
    const mapRoute = stage1Curricula
      .flatMap((curriculum) => curriculum.units)
      .find((unit) => unit.slug === "home-school-and-neighborhood");

    expect(mapRoute).toBeTruthy();
    expect(mapRoute!.game.layoutVariant).toBe("map_route");

    const mapStage = mapRoute!.game.stages.find((stage) => stage.kind === "map");
    expect(mapStage).toBeTruthy();
    expect(mapStage!.nodes.every((node) => typeof node.x === "number" && typeof node.y === "number"))
      .toBe(true);

    const connections = mapStage!.presentation?.connections ?? [];
    expect(connections.length).toBeGreaterThanOrEqual(mapStage!.correctPathIds.length - 1);

    for (let index = 0; index < mapStage!.correctPathIds.length - 1; index += 1) {
      expect(connections).toContainEqual({
        fromId: mapStage!.correctPathIds[index],
        toId: mapStage!.correctPathIds[index + 1],
      });
    }
  });

  it("authors Scene Scan with scene hotspot metadata", () => {
    const sceneScan = stage1Curricula
      .flatMap((curriculum) => curriculum.units)
      .find((unit) => unit.slug === "what-is-happening-now");

    expect(sceneScan).toBeTruthy();
    expect(sceneScan!.game.layoutVariant).toBe("scene_hotspots");

    const sceneStage = sceneScan!.game.stages.find((stage) => stage.kind === "spotlight");
    expect(sceneStage).toBeTruthy();
    const hotspots = sceneStage?.kind === "spotlight" ? sceneStage.hotspots : [];
    expect(hotspots.length).toBeGreaterThan(0);

    for (const hotspot of hotspots) {
      expect(hotspot.x).toBeGreaterThanOrEqual(0);
      expect(hotspot.x).toBeLessThanOrEqual(100);
      expect(hotspot.y).toBeGreaterThanOrEqual(0);
      expect(hotspot.y).toBeLessThanOrEqual(100);
    }
  });

  it("keeps voice content to the authored voice prompt stage", () => {
    for (const curriculum of stage1Curricula) {
      for (const unit of curriculum.units) {
        const voiceStages = unit.game.stages.filter((stage) => stage.kind === "voice_prompt");
        expect(voiceStages).toHaveLength(voiceGameSlugs.has(unit.slug) ? 1 : 0);
        expect(
          unit.game.stages
            .filter((stage) => stage.kind !== "voice_prompt")
            .every((stage) => !("targetPhrase" in stage))
        ).toBe(true);
      }
    }
  });

  it("uses practice prompts that bridge directly into the authored speaking mission", () => {
    for (const curriculum of CURRICULUM_BLUEPRINTS) {
      for (const unit of curriculum.units) {
        expect(unit.practiceQuestions).toHaveLength(3);

        if (
          curriculum.level === "basic" ||
          curriculum.level === "very_basic" ||
          curriculum.level === "intermediate" ||
          curriculum.level === "advanced"
        ) {
          for (const question of unit.practiceQuestions) {
            expect(question.prompt).not.toContain("answers the scene opener");
            expect(question.prompt).not.toContain("uses one of these unit phrases naturally");
            expect(question.prompt).not.toContain("keeps the conversation moving by answering");
          }
          continue;
        }

        expect(unit.practiceQuestions[0]?.prompt).toContain(unit.speakingMission.openingQuestion);
        expect(unit.practiceQuestions[1]?.prompt).toContain(
          unit.speakingMission.targetPhrases[0] ?? ""
        );
        expect(unit.practiceQuestions[2]?.prompt).toContain(
          unit.speakingMission.followUpPrompts[0] ?? ""
        );
      }
    }
  });

  it("fully hand-authors the Basic level activity content", () => {
    const basic = CURRICULUM_BLUEPRINTS.find((curriculum) => curriculum.level === "basic");
    expect(basic).toBeTruthy();

    for (const unit of basic!.units) {
      expect(unit.lessonSections[0]?.title).not.toBe("Scene and purpose");
      expect(unit.lessonSections[1]?.title).not.toBe("Useful language");
      expect(unit.game.introText).not.toContain("five key words from");
      expect(unit.writingCriteria).toHaveLength(3);
      expect(unit.checkpointQuestions[0]?.prompt).not.toBe(
        "Which response is closest to a strong answer for this unit?"
      );
    }
  });

  it("fully hand-authors the Very Basic level activity content", () => {
    const veryBasic = CURRICULUM_BLUEPRINTS.find(
      (curriculum) => curriculum.level === "very_basic"
    );
    expect(veryBasic).toBeTruthy();

    for (const unit of veryBasic!.units) {
      expect(unit.lessonSections[0]?.title).not.toBe("Scene and purpose");
      expect(unit.lessonSections[1]?.title).not.toBe("Useful language");
      expect(unit.game.introText).not.toContain("five key words from");
      expect(unit.writingCriteria).toHaveLength(3);
      expect(unit.checkpointQuestions[0]?.prompt).not.toBe(
        "Which response is closest to a strong answer for this unit?"
      );
      expect(unit.speakingMission.evidenceTargets[0]?.label).not.toBe(
        "Answer the task directly"
      );
      expect(unit.speakingMission.followUpObjectives[0]).not.toContain(
        "Ask the learner to answer this task directly"
      );
    }
  });

  it("fully hand-authors the Intermediate level activity content", () => {
    const intermediate = CURRICULUM_BLUEPRINTS.find(
      (curriculum) => curriculum.level === "intermediate"
    );
    expect(intermediate).toBeTruthy();

    for (const unit of intermediate!.units) {
      expect(unit.lessonSections[0]?.title).not.toBe("Scene and purpose");
      expect(unit.lessonSections[1]?.title).not.toBe("Useful language");
      expect(unit.game.gameTitle).not.toBe("Unit Game");
      expect(unit.game.introText).not.toContain("five key words from");
      expect(unit.game.stages.some((stage) => stage.kind !== "choice")).toBe(true);
      expect(unit.writingCriteria).toHaveLength(3);
      expect(unit.checkpointQuestions[0]?.prompt).not.toBe(
        "Which response is closest to a strong answer for this unit?"
      );
      expect(unit.speakingMission.evidenceTargets[0]?.label).not.toBe(
        "Answer the task directly"
      );
      expect(unit.speakingMission.followUpObjectives[0]).not.toContain(
        "Ask the learner to answer this task directly"
      );
    }
  });

  it("fully hand-authors the Advanced level activity content", () => {
    const advanced = CURRICULUM_BLUEPRINTS.find((curriculum) => curriculum.level === "advanced");
    expect(advanced).toBeTruthy();

    for (const unit of advanced!.units) {
      expect(unit.lessonSections[0]?.title).not.toBe("Scene and purpose");
      expect(unit.lessonSections[1]?.title).not.toBe("Useful language");
      expect(unit.game.gameTitle).not.toBe("Unit Game");
      expect(unit.game.introText).not.toContain("five key words from");
      expect(unit.game.stages.some((stage) => stage.kind !== "choice")).toBe(true);
      expect(unit.writingCriteria).toHaveLength(3);
      expect(unit.checkpointQuestions[0]?.prompt).not.toBe(
        "Which response is closest to a strong answer for this unit?"
      );
      expect(unit.speakingMission.evidenceTargets[0]?.label).not.toBe(
        "Answer the task directly"
      );
      expect(unit.speakingMission.followUpObjectives[0]).not.toContain(
        "Ask the learner to answer this task directly"
      );
    }
  });

  it("uses real benchmark expectations for Basic units three and six", () => {
    const basic = CURRICULUM_BLUEPRINTS.find((curriculum) => curriculum.level === "basic");
    expect(basic).toBeTruthy();

    const benchmarkUnits = basic!.units.filter((unit) => unit.speakingMission.isBenchmark);
    expect(benchmarkUnits.map((unit) => unit.slug)).toEqual([
      "what-is-happening-now",
      "comparing-choosing-and-short-narratives",
    ]);

    for (const unit of benchmarkUnits) {
      expect(unit.speakingMission.requiredTurns).toBe(5);
      expect(unit.speakingMission.minimumFollowUpResponses).toBe(2);
      expect(unit.speakingMission.evidenceTargets.length).toBeGreaterThanOrEqual(3);
      expect(unit.speakingMission.benchmarkFocus.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("uses stricter real benchmark expectations for Intermediate units three and six", () => {
    const intermediate = CURRICULUM_BLUEPRINTS.find(
      (curriculum) => curriculum.level === "intermediate"
    );
    expect(intermediate).toBeTruthy();

    const benchmarkUnits = intermediate!.units.filter((unit) => unit.speakingMission.isBenchmark);
    expect(benchmarkUnits.map((unit) => unit.slug)).toEqual([
      "solve-problems-and-make-decisions",
      "real-world-interaction-travel-interviews-presentations",
    ]);

    for (const unit of intermediate!.units) {
      if (unit.speakingMission.isBenchmark) {
        expect(unit.speakingMission.requiredTurns).toBe(6);
        expect(unit.speakingMission.minimumFollowUpResponses).toBe(2);
        expect(unit.speakingMission.evidenceTargets.length).toBeGreaterThanOrEqual(4);
        expect(unit.speakingMission.benchmarkFocus.length).toBeGreaterThanOrEqual(2);
      } else {
        expect(unit.speakingMission.requiredTurns).toBe(4);
        expect(unit.speakingMission.minimumFollowUpResponses).toBe(1);
      }
    }
  });

  it("uses the strictest real benchmark expectations for Advanced units three and six", () => {
    const advanced = CURRICULUM_BLUEPRINTS.find((curriculum) => curriculum.level === "advanced");
    expect(advanced).toBeTruthy();

    const benchmarkUnits = advanced!.units.filter((unit) => unit.speakingMission.isBenchmark);
    expect(benchmarkUnits.map((unit) => unit.slug)).toEqual([
      "debate-persuade-and-respond",
      "capstone-synthesize-argue-recommend",
    ]);

    for (const unit of advanced!.units) {
      if (unit.speakingMission.isBenchmark) {
        expect(unit.speakingMission.requiredTurns).toBe(7);
        expect(unit.speakingMission.minimumFollowUpResponses).toBe(3);
        expect(unit.speakingMission.evidenceTargets.length).toBeGreaterThanOrEqual(4);
        expect(unit.speakingMission.benchmarkFocus.length).toBeGreaterThanOrEqual(2);
      } else {
        expect(unit.speakingMission.requiredTurns).toBe(5);
        expect(unit.speakingMission.minimumFollowUpResponses).toBe(2);
      }
    }
  });

  it("uses lighter real benchmark expectations for Very Basic units three and six", () => {
    const veryBasic = CURRICULUM_BLUEPRINTS.find(
      (curriculum) => curriculum.level === "very_basic"
    );
    expect(veryBasic).toBeTruthy();

    const benchmarkUnits = veryBasic!.units.filter((unit) => unit.speakingMission.isBenchmark);
    expect(benchmarkUnits.map((unit) => unit.slug)).toEqual([
      "daily-routines-time-and-schedules",
      "simple-plans-weather-and-practical-review",
    ]);

    for (const unit of benchmarkUnits) {
      expect(unit.speakingMission.requiredTurns).toBe(4);
      expect(unit.speakingMission.minimumFollowUpResponses).toBe(1);
      expect(unit.speakingMission.evidenceTargets.length).toBeGreaterThanOrEqual(3);
      expect(unit.speakingMission.benchmarkFocus.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("scales writing expectations by level instead of using one sentence count everywhere", () => {
    const rangesByLevel = new Map(
      CURRICULUM_BLUEPRINTS.map((curriculum) => [
        curriculum.level,
        curriculum.units.map((unit) => unit.writingPrompt),
      ])
    );

    expect(
      rangesByLevel.get("very_basic")?.every((prompt) => prompt.includes("3 to 5 simple sentences"))
    ).toBe(true);
    expect(
      rangesByLevel.get("basic")?.every((prompt) => prompt.includes("4 to 6 connected sentences"))
    ).toBe(true);
    expect(
      rangesByLevel
        .get("intermediate")
        ?.every((prompt) => prompt.includes("5 to 7 connected sentences"))
    ).toBe(true);
    expect(
      rangesByLevel
        .get("advanced")
        ?.every((prompt) => prompt.includes("6 to 8 polished sentences or one short paragraph"))
    ).toBe(true);
  });
});
