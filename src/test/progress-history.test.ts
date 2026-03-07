import { describe, expect, it } from "vitest";

import {
  buildSkillTrendData,
  getVisibleHistory,
  summarizeProgress,
  type ProgressHistoryPoint,
} from "@/lib/progress";

const history: ProgressHistoryPoint[] = [
  {
    reportId: "report-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    overallScore: 52,
    reportType: "baseline_quick",
    levelLabel: "basic",
    skills: {
      listening: 50,
      speaking: 48,
      reading: 55,
      writing: 46,
      vocabulary: 54,
      grammar: 49,
    },
  },
  {
    reportId: "report-2",
    createdAt: "2026-02-01T00:00:00.000Z",
    overallScore: 61,
    reportType: "baseline_full",
    levelLabel: "basic",
    skills: {
      listening: 57,
      speaking: 62,
      reading: 60,
      writing: 56,
      vocabulary: 63,
      grammar: 58,
    },
  },
  {
    reportId: "report-3",
    createdAt: "2026-03-01T00:00:00.000Z",
    overallScore: 68,
    reportType: "reassessment",
    levelLabel: "intermediate",
    skills: {
      listening: 64,
      speaking: 71,
      reading: 66,
      writing: 61,
      vocabulary: 70,
      grammar: 63,
    },
  },
];

describe("progress history helpers", () => {
  it("filters to the last 90 days when recent reports exist", () => {
    const visible = getVisibleHistory(history, "90d", new Date("2026-04-15T00:00:00.000Z"));

    expect(visible.appliedRange).toBe("90d");
    expect(visible.usedFallback).toBe(false);
    expect(visible.points).toHaveLength(2);
    expect(visible.points[0].reportId).toBe("report-2");
  });

  it("falls back to all time when the 90 day window would be empty", () => {
    const visible = getVisibleHistory(history, "90d", new Date("2026-08-01T00:00:00.000Z"));

    expect(visible.appliedRange).toBe("all");
    expect(visible.usedFallback).toBe(true);
    expect(visible.points).toHaveLength(3);
  });

  it("summarizes overall delta, strongest growth, and focus skill", () => {
    const summary = summarizeProgress(history);

    expect(summary.reportCount).toBe(3);
    expect(summary.overallDelta).toBe(16);
    expect(summary.strongestGrowth).toEqual({
      skill: "speaking",
      delta: 23,
    });
    expect(summary.focusSkill).toEqual({
      skill: "writing",
      score: 61,
    });
    expect(summary.milestoneCount).toBe(2);
  });

  it("builds per-skill series for sparkline cards", () => {
    const skillTrends = buildSkillTrendData(history);
    const speaking = skillTrends.find((item) => item.skill === "speaking");

    expect(speaking).toMatchObject({
      skill: "speaking",
      latestScore: 71,
      delta: 23,
      scores: [48, 62, 71],
    });
  });
});
