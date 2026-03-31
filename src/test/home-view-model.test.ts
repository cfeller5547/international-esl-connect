/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { buildHomeViewModel } from "@/features/home/home-view-model";

describe("home view model", () => {
  it("dedupes the hero target from secondary actions", () => {
    const viewModel = buildHomeViewModel({
      recommendation: {
        actionType: "continue_test_prep",
        title: "Continue test prep",
        targetUrl: "/app/tools/test-prep",
        reason: "Your exam is close.",
        reasonCode: "continue_test_prep",
      },
      latestReport: null,
      streak: {
        currentStreakDays: 0,
        longestStreakDays: 0,
        nextMilestoneDays: 3,
      },
      currentLevel: "intermediate",
      fullDiagnosticCompletedAt: new Date(),
    });

    expect(
      viewModel.secondaryActions.some((action) => action.href === "/app/tools/test-prep")
    ).toBe(false);
  });

  it("always keeps the urgent homework action visible", () => {
    const viewModel = buildHomeViewModel({
      recommendation: {
        actionType: "continue_curriculum",
        title: "Continue Tell Stories Clearly",
        targetUrl: "/app/learn/unit/tell-stories-clearly/lesson",
        reason: "Keep moving through the next required lesson.",
        reasonCode: "continue_curriculum",
      },
      latestReport: null,
      streak: {
        currentStreakDays: 1,
        longestStreakDays: 1,
        nextMilestoneDays: 3,
      },
      currentLevel: "intermediate",
      fullDiagnosticCompletedAt: new Date(),
    });

    expect(viewModel.urgentHomeworkAction.href).toBe("/app/tools/homework");
    expect(viewModel.urgentHomeworkAction.title).toBe("Homework Help now");
  });

  it("falls back to placement pending before the full diagnostic is complete", () => {
    const viewModel = buildHomeViewModel({
      recommendation: {
        actionType: "complete_full_diagnostic",
        title: "Complete full diagnostic",
        targetUrl: "/app/assessment/full",
        reason: "Unlock your starting level.",
        reasonCode: "complete_full_diagnostic",
      },
      latestReport: null,
      streak: {
        currentStreakDays: 0,
        longestStreakDays: 0,
        nextMilestoneDays: 3,
      },
      currentLevel: null,
      fullDiagnosticCompletedAt: null,
    });

    expect(viewModel.supportItems[0].value).toBe("Placement pending");
  });

  it("shows resume homework help while keeping the urgent homework pill available", () => {
    const viewModel = buildHomeViewModel({
      recommendation: {
        actionType: "resume_homework_help",
        title: "Resume homework help",
        targetUrl: "/app/tools/homework/session/session-123",
        reason: "You already have work in progress.",
        reasonCode: "resume_homework_help",
      },
      latestReport: {
        overallScore: 72,
        levelLabel: "intermediate",
        skillSnapshots: [
          { skill: "reading", score: 78 },
          { skill: "grammar", score: 64 },
        ],
      },
      streak: {
        currentStreakDays: 2,
        longestStreakDays: 2,
        nextMilestoneDays: 3,
      },
      currentLevel: "intermediate",
      fullDiagnosticCompletedAt: new Date(),
    });

    expect(viewModel.hero.href).toBe("/app/tools/homework/session/session-123");
    expect(viewModel.urgentHomeworkAction.href).toBe("/app/tools/homework");
  });

  it("builds a compact learning picture from the latest report", () => {
    const viewModel = buildHomeViewModel({
      recommendation: {
        actionType: "continue_curriculum",
        title: "Continue Tell Stories Clearly",
        targetUrl: "/app/learn/unit/tell-stories-clearly/lesson",
        reason: "Keep moving through the next required lesson.",
        reasonCode: "continue_curriculum",
      },
      latestReport: {
        overallScore: 81,
        levelLabel: "advanced",
        skillSnapshots: [
          { skill: "speaking", score: 88 },
          { skill: "grammar", score: 68 },
          { skill: "writing", score: 82 },
        ],
      },
      streak: {
        currentStreakDays: 4,
        longestStreakDays: 4,
        nextMilestoneDays: 7,
      },
      currentLevel: "advanced",
      fullDiagnosticCompletedAt: new Date(),
    });

    expect(viewModel.learningPicture.state).toBe("report");

    if (viewModel.learningPicture.state === "report") {
      expect(viewModel.learningPicture.strongestSkill).toBe("Speaking");
      expect(viewModel.learningPicture.focusSkill).toBe("Grammar");
      expect(viewModel.learningPicture.overallScore).toBe(81);
    }
  });

  it("points the learn roadmap secondary action at the dedicated roadmap route", () => {
    const viewModel = buildHomeViewModel({
      recommendation: {
        actionType: "resume_homework_help",
        title: "Resume homework help",
        targetUrl: "/app/tools/homework/session/session-123",
        reason: "You already have work in progress.",
        reasonCode: "resume_homework_help",
      },
      latestReport: null,
      streak: {
        currentStreakDays: 2,
        longestStreakDays: 2,
        nextMilestoneDays: 3,
      },
      currentLevel: "basic",
      fullDiagnosticCompletedAt: new Date(),
    });

    const roadmapAction = viewModel.secondaryActions.find((action) => action.key === "learn_roadmap");
    expect(roadmapAction?.href).toBe("/app/learn/roadmap");
  });
});
