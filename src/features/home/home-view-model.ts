import { toTitleCase } from "@/lib/utils";

export type HomeRecommendation = {
  actionType: string;
  title: string;
  targetUrl: string;
  reason: string;
  reasonCode: string;
};

export type HomeReportSnapshot = {
  overallScore: number;
  levelLabel: string;
  skillSnapshots: Array<{
    skill: string;
    score: number;
  }>;
};

export type HomeStreakSnapshot = {
  currentStreakDays: number;
  longestStreakDays: number;
  nextMilestoneDays?: number | null;
};

type BuildHomeViewModelInput = {
  recommendation: HomeRecommendation;
  latestReport: HomeReportSnapshot | null;
  streak: HomeStreakSnapshot;
  currentLevel: string | null;
  fullDiagnosticCompletedAt: Date | null;
};

type HomeSupportItem = {
  label: string;
  value: string;
  detail: string;
};

type HomeSecondaryAction = {
  key: "learn_roadmap" | "test_prep" | "view_progress";
  title: string;
  href: string;
  body: string;
};

export type HomeViewModel = {
  hero: {
    eyebrow: string;
    contextLabel: string;
    title: string;
    reason: string;
    ctaLabel: string;
    href: string;
    sideLabel: string;
    sideTitle: string;
    sideBody: string;
  };
  urgentHomeworkAction: {
    title: string;
    href: string;
  };
  supportItems: [HomeSupportItem, HomeSupportItem];
  secondaryActions: HomeSecondaryAction[];
  learningPicture:
    | {
        state: "report";
        levelLabel: string;
        overallScore: number;
        strongestSkill: string | null;
        focusSkill: string | null;
      }
    | {
        state: "empty";
      };
};

export function buildHomeViewModel({
  recommendation,
  latestReport,
  streak,
  currentLevel,
  fullDiagnosticCompletedAt,
}: BuildHomeViewModelInput): HomeViewModel {
  return {
    hero: {
      eyebrow: getHeroEyebrow(recommendation),
      contextLabel: getHeroContextLabel(recommendation, currentLevel),
      title: getHeroTitle(recommendation),
      reason: recommendation.reason,
      ctaLabel: getHeroCtaLabel(recommendation),
      href: recommendation.targetUrl,
      ...getHeroSidePanel(recommendation),
    },
    urgentHomeworkAction: {
      title: "Homework Help now",
      href: "/app/tools/homework",
    },
    supportItems: [
      getCurrentFocusItem({
        recommendation,
        latestReport,
        currentLevel,
        fullDiagnosticCompletedAt,
      }),
      getLearningRhythmItem(streak),
    ],
    secondaryActions: buildSecondaryActions({
      recommendation,
      latestReport,
      fullDiagnosticCompletedAt,
    }),
    learningPicture: buildLearningPicture(latestReport),
  };
}

function getHeroTitle(recommendation: HomeRecommendation) {
  switch (recommendation.actionType) {
    case "complete_full_diagnostic":
      return "Confirm your starting level";
    case "resume_homework_help":
      return "Keep this assignment moving";
    case "start_homework_help":
      return "Get this assignment unstuck";
    case "continue_test_prep":
      return "Stay on track for your test";
    case "continue_curriculum":
      return recommendation.title.replace(/^Continue\s+/i, "") || recommendation.title;
    default:
      return recommendation.title;
  }
}

function getHeroCtaLabel(recommendation: HomeRecommendation) {
  switch (recommendation.actionType) {
    case "complete_full_diagnostic":
      return "Complete diagnostic";
    case "resume_homework_help":
      return "Resume session";
    case "start_homework_help":
      return "Open homework help";
    case "continue_test_prep":
      return "Continue test prep";
    case "continue_curriculum":
      return "Continue learning";
    default:
      return recommendation.title;
  }
}

function getHeroEyebrow(recommendation: HomeRecommendation) {
  switch (recommendation.actionType) {
    case "complete_full_diagnostic":
      return "Placement";
    case "resume_homework_help":
      return "In progress";
    case "start_homework_help":
      return "Urgent help";
    case "continue_test_prep":
      return "Time-sensitive";
    case "continue_curriculum":
      return "Today in Learn";
    default:
      return "Right now";
  }
}

function getHeroContextLabel(recommendation: HomeRecommendation, currentLevel: string | null) {
  switch (recommendation.actionType) {
    case "complete_full_diagnostic":
      return "Assessment";
    case "resume_homework_help":
    case "start_homework_help":
      return "Homework Help";
    case "continue_test_prep":
      return "Test Prep Sprint";
    case "continue_curriculum":
      return currentLevel ? `${toTitleCase(currentLevel)} curriculum` : "Learn";
    default:
      return "Plan";
  }
}

function getHeroSidePanel(recommendation: HomeRecommendation) {
  switch (recommendation.actionType) {
    case "resume_homework_help":
      return {
        sideLabel: "Quick move",
        sideTitle: "Need a different assignment?",
        sideBody: "Open Homework Help to start a new upload without losing this active session.",
      };
    case "start_homework_help":
      return {
        sideLabel: "Quick move",
        sideTitle: "Use it fast",
        sideBody: "Drop in a screenshot, photo, or PDF when class work is blocking you.",
      };
    case "continue_test_prep":
      return {
        sideLabel: "Quick move",
        sideTitle: "Keep the rest of the week calm",
        sideBody: "Use Homework Help for live class work and keep test prep for the time you set aside.",
      };
    case "continue_curriculum":
      return {
        sideLabel: "Quick move",
        sideTitle: "If class gets urgent",
        sideBody: "Homework Help stays one tap away whenever schoolwork needs immediate guided support.",
      };
    case "complete_full_diagnostic":
      return {
        sideLabel: "After this",
        sideTitle: "Sharper next steps",
        sideBody: "Once placement is confirmed, Learn and Progress can guide you much more precisely.",
      };
    default:
      return {
        sideLabel: "Quick move",
        sideTitle: "Stay in flow",
        sideBody: "Keep the planned step simple and use Homework Help only when class work becomes urgent.",
      };
  }
}

function getCurrentFocusItem({
  recommendation,
  latestReport,
  currentLevel,
  fullDiagnosticCompletedAt,
}: {
  recommendation: HomeRecommendation;
  latestReport: HomeReportSnapshot | null;
  currentLevel: string | null;
  fullDiagnosticCompletedAt: Date | null;
}): HomeSupportItem {
  if (!fullDiagnosticCompletedAt) {
    return {
      label: "Current focus",
      value: "Placement pending",
      detail: "Finish your full diagnostic before Learn starts guiding you.",
    };
  }

  switch (recommendation.actionType) {
    case "resume_homework_help":
    case "start_homework_help":
      return {
        label: "Current focus",
        value: "Homework support",
        detail: "Use guided help to keep class work moving without losing momentum.",
      };
    case "continue_test_prep":
      return {
        label: "Current focus",
        value: "Test prep sprint",
        detail: "Stay on pace for your next exam with a short, date-bound plan.",
      };
    case "continue_curriculum":
      return {
        label: "Current focus",
        value: currentLevel ? `${toTitleCase(currentLevel)} curriculum` : "Curriculum path",
        detail: `Next: ${recommendation.title.replace(/^Continue\s+/i, "") || recommendation.title}`,
      };
    default:
      if (latestReport) {
        return {
          label: "Current focus",
          value: `${toTitleCase(latestReport.levelLabel)} level`,
          detail: `Latest overall score: ${latestReport.overallScore}`,
        };
      }

      return {
        label: "Current focus",
        value: "Learning plan",
        detail: "Keep your next move simple and stay with the guided recommendation.",
      };
  }
}

function getLearningRhythmItem(streak: HomeStreakSnapshot): HomeSupportItem {
  if (streak.currentStreakDays > 0) {
    return {
      label: "Learning rhythm",
      value: `${streak.currentStreakDays}-day streak`,
      detail: streak.nextMilestoneDays
        ? `Next milestone: ${streak.nextMilestoneDays} days`
        : `Longest streak: ${streak.longestStreakDays} days`,
    };
  }

  return {
    label: "Learning rhythm",
    value: "Start your first streak",
    detail: streak.nextMilestoneDays
      ? `One focused session gets you moving toward ${streak.nextMilestoneDays} days.`
      : "One focused session today is enough to build momentum.",
  };
}

function buildSecondaryActions({
  recommendation,
  latestReport,
  fullDiagnosticCompletedAt,
}: {
  recommendation: HomeRecommendation;
  latestReport: HomeReportSnapshot | null;
  fullDiagnosticCompletedAt: Date | null;
}): HomeSecondaryAction[] {
  const actions: HomeSecondaryAction[] = [];

  if (fullDiagnosticCompletedAt && recommendation.actionType !== "continue_curriculum") {
    actions.push({
      key: "learn_roadmap",
      title: "Learn roadmap",
      href: "/app/learn",
      body: "Stay close to your assigned curriculum path.",
    });
  }

  if (recommendation.actionType !== "continue_test_prep") {
    actions.push({
      key: "test_prep",
      title: "Test Prep Sprint",
      href: "/app/tools/test-prep",
      body: "Spin up a short plan around an upcoming exam.",
    });
  }

  actions.push({
    key: "view_progress",
    title: "View progress",
    href: "/app/progress",
    body: latestReport
      ? "See your reports, trends, and reassessment options."
      : "Your reports and trend history will build here.",
  });

  return actions
    .filter((action) => action.href !== recommendation.targetUrl)
    .slice(0, 2);
}

function buildLearningPicture(
  latestReport: HomeReportSnapshot | null
): HomeViewModel["learningPicture"] {
  if (!latestReport) {
    return { state: "empty" };
  }

  const strongestSkill = [...latestReport.skillSnapshots].sort((a, b) => b.score - a.score)[0];
  const focusSkill = [...latestReport.skillSnapshots].sort((a, b) => a.score - b.score)[0];

  return {
    state: "report",
    levelLabel: toTitleCase(latestReport.levelLabel),
    overallScore: latestReport.overallScore,
    strongestSkill: strongestSkill ? toTitleCase(strongestSkill.skill) : null,
    focusSkill: focusSkill ? toTitleCase(focusSkill.skill) : null,
  };
}
