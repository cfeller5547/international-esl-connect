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
    "food-shopping-and-likes-dislikes",
    "past-events-and-weekend-stories",
    "what-is-happening-now",
    "health-travel-and-everyday-services",
    "comparing-choosing-and-short-narratives",
  ]);
  const extendedArcadeGameSlugs = new Set([
    "past-events-and-weekend-stories",
    "what-is-happening-now",
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
        expect(unit.game.ambientSet).toBeTruthy();
        expect(unit.game.celebrationVariant).toBe("arcade_pulse");
        expect(unit.game.stages).toHaveLength(extendedArcadeGameSlugs.has(unit.slug) ? 4 : 3);
        expect(unit.game.completionRule.requiredStageCount).toBe(unit.game.stages.length);
        expect(unit.game.completionRule.maxRetriesPerStage).toBe(2);
        expect(
          unit.game.stages.every(
            (stage) => stage.title.trim().length > 0 && stage.prompt.trim().length > 0
          )
        ).toBe(true);
        const voiceStageCount = unit.game.stages.filter(
          (stage) => stage.kind === "voice_burst"
        ).length;
        expect(voiceStageCount).toBe(voiceGameSlugs.has(unit.slug) ? 1 : 0);
        expect(
          unit.game.stages.every((stage) =>
            ["lane_runner", "sort_rush", "route_race", "reaction_pick", "voice_burst"].includes(
              stage.kind
            )
          )
        ).toBe(true);
        expect(
          unit.game.stages.every((stage) => {
            expect(stage.presentation?.layoutVariant).toBeTruthy();
            if (stage.kind === "reaction_pick") {
              expect(stage.presentation?.answerRevealMode).toBe("postanswer");
              expect(stage.spriteRefs?.neutral).toBeTruthy();
            }

            return true;
          })
        ).toBe(true);
      }
    }
  });

  it("exercises the Stage 5 arcade mechanics across the current 12 games", () => {
    const stageKinds = new Set(
      stage1Curricula.flatMap((curriculum) =>
        curriculum.units.flatMap((unit) => unit.game.stages.map((stage) => stage.kind))
      )
    );

    expect(stageKinds.has("lane_runner")).toBe(true);
    expect(stageKinds.has("sort_rush")).toBe(true);
    expect(stageKinds.has("route_race")).toBe(true);
    expect(stageKinds.has("reaction_pick")).toBe(true);
    expect(stageKinds.has("voice_burst")).toBe(true);
  });

  it("authors Name Tag Mixer with the Stage 5 arcade flow", () => {
    const introUnit = stage1Curricula
      .flatMap((curriculum) => curriculum.units)
      .find((unit) => unit.slug === "introductions-and-personal-information");

    expect(introUnit).toBeTruthy();
    expect(introUnit!.game.gameTitle).toBe("Name Tag Mixer");
    expect(introUnit!.game.stages.map((stage) => stage.kind)).toEqual([
      "lane_runner",
      "reaction_pick",
      "voice_burst",
    ]);
    expect(introUnit!.game.stages[0]?.presentation?.layoutVariant).toBe("arcade_lane_runner");
    expect(introUnit!.game.stages[1]?.presentation?.layoutVariant).toBe("arcade_reaction_pick");
    expect(introUnit!.game.stages[2]?.presentation?.layoutVariant).toBe("voice_focus");
    expect(
      introUnit!.game.stages[0]?.kind === "lane_runner"
        ? introUnit!.game.stages[0].spriteRefs?.board ?? ""
        : ""
    ).toContain("name-tag-hallway-board");
    expect(
      introUnit!.game.stages[1]?.kind === "reaction_pick"
        ? introUnit!.game.stages[1].rounds[0]?.prompt
        : ""
    ).toContain("Hi, I'm Ana.");
    expect(
      introUnit!.game.stages[0]?.kind === "lane_runner"
        ? introUnit!.game.stages[0].targetSequenceIds
        : []
    ).toEqual(
      expect.arrayContaining(["token-hi", "token-ana", "token-brazil", "token-question"])
    );
    expect(
      introUnit!.game.stages[1]?.kind === "reaction_pick"
        ? introUnit!.game.stages[1].rounds[0]?.options[0]?.label
        : ""
    ).toBe("Where are you from?");
    expect(
      introUnit!.game.stages[1]?.kind === "reaction_pick"
        ? introUnit!.game.stages[1].interactionModel
        : null
    ).toBe("target_tag");
    expect(
      introUnit!.game.stages[0]?.kind === "lane_runner"
        ? introUnit!.game.stages[0].spriteRefs?.board ?? ""
        : ""
    ).toContain("name-tag-hallway-board");
    expect(
      introUnit!.game.stages[1]?.kind === "reaction_pick"
        ? introUnit!.game.stages[1].spriteRefs?.board ?? ""
        : ""
    ).toContain("name-tag-chat-board");
  });

  it("exposes stage-one arcade theme and layout metadata on every authored game", () => {
    for (const curriculum of stage1Curricula) {
      for (const unit of curriculum.units) {
        expect(unit.game.theme).toBeTruthy();
        expect(unit.game.layoutVariant).toBeTruthy();
        expect(unit.game.assetRefs.hero).toBeTruthy();
        expect(unit.game.layoutVariant.startsWith("arcade_")).toBe(true);
      }
    }
  });

  it("authors Map Route with route-race nodes and explicit path connections", () => {
    const mapRoute = stage1Curricula
      .flatMap((curriculum) => curriculum.units)
      .find((unit) => unit.slug === "home-school-and-neighborhood");

    expect(mapRoute).toBeTruthy();
    expect(mapRoute!.game.layoutVariant).toBe("arcade_route_race");

    const mapStage = mapRoute!.game.stages.find((stage) => stage.kind === "route_race");
    expect(mapStage).toBeTruthy();
    expect(mapStage?.kind === "route_race" ? mapStage.spriteRefs?.board ?? "" : "").toContain(
      "map-route-showcase-board"
    );
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

  it("authors Scene Scan with lane-runner action tags and follow-up reaction rounds", () => {
    const sceneScan = stage1Curricula
      .flatMap((curriculum) => curriculum.units)
      .find((unit) => unit.slug === "what-is-happening-now");

    expect(sceneScan).toBeTruthy();
    expect(sceneScan!.game.layoutVariant).toBe("arcade_lane_runner");

    const sceneStage = sceneScan!.game.stages.find((stage) => stage.kind === "lane_runner");
    expect(sceneStage).toBeTruthy();
    const tokens = sceneStage?.kind === "lane_runner" ? sceneStage.tokens : [];
    expect(tokens.length).toBeGreaterThanOrEqual(6);
    expect(tokens.some((token) => token.role === "target")).toBe(true);
    expect(tokens.some((token) => token.role === "hazard")).toBe(true);
    expect(sceneStage?.spriteRefs?.board ?? "").toContain("scene-classroom-board");
    expect(sceneScan!.game.stages.some((stage) => stage.kind === "reaction_pick")).toBe(true);
    expect(sceneScan!.game.stages.some((stage) => stage.kind === "voice_burst")).toBe(true);
  });

  it("keeps voice content to the selected Stage 9 voice burst games", () => {
    for (const curriculum of stage1Curricula) {
      for (const unit of curriculum.units) {
        const voiceStages = unit.game.stages.filter((stage) => stage.kind === "voice_burst");
        expect(voiceStages).toHaveLength(voiceGameSlugs.has(unit.slug) ? 1 : 0);
        expect(
          unit.game.stages
            .filter((stage) => stage.kind !== "voice_burst")
            .every((stage) => !("targetPhrase" in stage))
        ).toBe(true);
      }
    }
  });

  it("adds spoken transfer to Story Chain and Scene Scan without making every game voice-first", () => {
    const stage1Units = stage1Curricula.flatMap((curriculum) => curriculum.units);
    const storyChain = stage1Units.find((unit) => unit.slug === "past-events-and-weekend-stories");
    const sceneScan = stage1Units.find((unit) => unit.slug === "what-is-happening-now");
    const storyLastStage = storyChain?.game.stages.at(-1) ?? null;
    const sceneLastStage = sceneScan?.game.stages.at(-1) ?? null;
    const storyVoiceStage = storyLastStage?.kind === "voice_burst" ? storyLastStage : null;
    const sceneVoiceStage = sceneLastStage?.kind === "voice_burst" ? sceneLastStage : null;

    expect(storyChain?.game.stages.at(-1)?.kind).toBe("voice_burst");
    expect(sceneScan?.game.stages.at(-1)?.kind).toBe("voice_burst");
    expect(storyVoiceStage?.targetPhrase ?? "").toContain("First");
    expect(storyVoiceStage?.targetPhrase ?? "").toContain("movie");
    expect(storyVoiceStage?.spriteRefs?.board ?? "").toContain("story-comic-board");
    expect(sceneVoiceStage?.targetPhrase ?? "").toContain("teacher");
    expect(sceneVoiceStage?.spriteRefs?.board ?? "").toContain("scene-classroom-board");
  });

  it("keeps the showcase-route and scene games grounded in one clearly strongest answer path", () => {
    const stage1Units = stage1Curricula.flatMap((curriculum) => curriculum.units);
    const mapRoute = stage1Units.find((unit) => unit.slug === "home-school-and-neighborhood");
    const storyChain = stage1Units.find((unit) => unit.slug === "past-events-and-weekend-stories");
    const sceneScan = stage1Units.find((unit) => unit.slug === "what-is-happening-now");

    const mapReaction = mapRoute?.game.stages.find((stage) => stage.kind === "reaction_pick");
    const storyReaction = storyChain?.game.stages.find((stage) => stage.kind === "reaction_pick");
    const sceneReaction = sceneScan?.game.stages.find((stage) => stage.kind === "reaction_pick");

    expect(mapReaction?.kind === "reaction_pick" ? mapReaction.interactionModel : null).toBe("split_decision");
    expect(storyReaction?.kind === "reaction_pick" ? storyReaction.interactionModel : null).toBe("split_decision");
    expect(
      mapReaction?.kind === "reaction_pick"
        ? mapReaction.rounds[0]?.options.filter((option) => option.isNearMiss).length
        : 0
    ).toBe(1);
    expect(
      sceneReaction?.kind === "reaction_pick"
        ? sceneReaction.rounds.every((round) =>
            round.options.some((option) => option.isNearMiss) &&
            round.options.some((option) => option.id === round.correctOptionId)
          )
        : false
    ).toBe(true);
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
