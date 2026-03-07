import { subDays } from "date-fns";

import { SKILLS } from "@/lib/constants";

export type SkillKey = (typeof SKILLS)[number];
export type ProgressRange = "90d" | "all";

export type ProgressHistoryPoint = {
  reportId: string;
  createdAt: string;
  overallScore: number;
  reportType: string;
  levelLabel: string;
  skills: Record<SkillKey, number>;
};

export type VisibleHistoryResult = {
  points: ProgressHistoryPoint[];
  appliedRange: ProgressRange;
  usedFallback: boolean;
};

export function getReportTypeLabel(reportType: string) {
  switch (reportType) {
    case "baseline_quick":
      return "Quick baseline";
    case "baseline_full":
      return "Full diagnostic";
    case "reassessment":
      return "Reassessment";
    case "mini_mock":
      return "Mini mock";
    default:
      return reportType.replaceAll("_", " ");
  }
}

export function isMilestoneReport(reportType: string) {
  return reportType === "baseline_full" || reportType === "reassessment";
}

export function getVisibleHistory(
  points: ProgressHistoryPoint[],
  range: ProgressRange,
  now = new Date()
): VisibleHistoryResult {
  if (range === "all") {
    return {
      points,
      appliedRange: "all",
      usedFallback: false,
    };
  }

  const cutoff = subDays(now, 90);
  const recentPoints = points.filter((point) => new Date(point.createdAt) >= cutoff);

  if (recentPoints.length === 0) {
    return {
      points,
      appliedRange: "all",
      usedFallback: true,
    };
  }

  return {
    points: recentPoints,
    appliedRange: "90d",
    usedFallback: false,
  };
}

export function summarizeProgress(points: ProgressHistoryPoint[]) {
  const first = points[0];
  const latest = points[points.length - 1];

  if (!first || !latest) {
    return {
      reportCount: 0,
      overallDelta: 0,
      strongestGrowth: null as { skill: SkillKey; delta: number } | null,
      focusSkill: null as { skill: SkillKey; score: number } | null,
      milestoneCount: 0,
    };
  }

  const strongestGrowth = SKILLS.reduce<{ skill: SkillKey; delta: number } | null>(
    (currentBest, skill) => {
      const delta = latest.skills[skill] - first.skills[skill];

      if (!currentBest || delta > currentBest.delta) {
        return { skill, delta };
      }

      return currentBest;
    },
    null
  );

  const focusSkill = SKILLS.reduce<{ skill: SkillKey; score: number } | null>(
    (currentLowest, skill) => {
      const score = latest.skills[skill];

      if (!currentLowest || score < currentLowest.score) {
        return { skill, score };
      }

      return currentLowest;
    },
    null
  );

  return {
    reportCount: points.length,
    overallDelta: latest.overallScore - first.overallScore,
    strongestGrowth,
    focusSkill,
    milestoneCount: points.filter((point) => isMilestoneReport(point.reportType)).length,
  };
}

export function buildSkillTrendData(points: ProgressHistoryPoint[]) {
  return SKILLS.map((skill) => {
    const scores = points.map((point) => point.skills[skill]);
    const latestScore = scores.at(-1) ?? 0;
    const firstScore = scores[0] ?? latestScore;

    return {
      skill,
      scores,
      latestScore,
      delta: latestScore - firstScore,
    };
  });
}
