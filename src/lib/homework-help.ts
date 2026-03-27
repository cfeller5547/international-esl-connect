export type HomeworkContentShape =
  | "single_question"
  | "multi_question"
  | "passage_plus_questions"
  | "mixed_or_unclear";

export type HomeworkConfidenceState = "ready" | "warning" | "blocked";

export type HomeworkCoachAction = "explain" | "plan" | "hint" | "check" | "submit";

export type HomeworkCoachEntry = {
  action: HomeworkCoachAction;
  coachTitle: string;
  coachMessage: string;
  checklist: string[];
  suggestedStarter: string | null;
  result: string;
  readyToSubmit: boolean;
};

export type HomeworkQuestionStateStatus =
  | "not_started"
  | "in_progress"
  | "ready_to_submit"
  | "completed";

export type HomeworkQuestionState = {
  index: number;
  status: HomeworkQuestionStateStatus;
  latestDraft: string;
  hintLevel: number;
  recommendedAction: HomeworkCoachAction;
  coachEntries: HomeworkCoachEntry[];
};

export type HomeworkSessionState = {
  currentQuestionIndex: number;
  questionStates: HomeworkQuestionState[];
};

export type HomeworkCompletionSummary = {
  handledWell: string;
  watchNextTime: string;
  strategyThatHelped: string;
};

type HomeworkQuestionLike = {
  index: number;
  promptText: string;
  successCriteria?: string[] | null;
};

type HomeworkStepLike = {
  questionIndex: number;
  result: string;
  hintLevelUsed: number;
  studentAnswer?: unknown;
  feedbackPayload?: unknown;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTextList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 4);
}

function getQuestionStateDefaults(index: number): HomeworkQuestionState {
  return {
    index,
    status: "not_started",
    latestDraft: "",
    hintLevel: 0,
    recommendedAction: "explain",
    coachEntries: [],
  };
}

function getDraftWordCount(draft: string) {
  return draft
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function getLatestQuestionState(states: HomeworkQuestionState[], questionIndex: number) {
  return states[questionIndex] ?? getQuestionStateDefaults(questionIndex);
}

function getStepAction(step: HomeworkStepLike): HomeworkCoachAction {
  const studentAnswer = (step.studentAnswer ?? {}) as { action?: unknown };
  const feedbackPayload = (step.feedbackPayload ?? {}) as { action?: unknown };
  const action = feedbackPayload.action ?? studentAnswer.action;

  return action === "plan" ||
    action === "hint" ||
    action === "check" ||
    action === "submit"
    ? action
    : "explain";
}

function createCoachEntryFromStep(step: HomeworkStepLike): HomeworkCoachEntry {
  const feedbackPayload = (step.feedbackPayload ?? {}) as {
    action?: unknown;
    coachTitle?: unknown;
    coachMessage?: unknown;
    checklist?: unknown;
    suggestedStarter?: unknown;
    result?: unknown;
    readyToSubmit?: unknown;
  };

  return {
    action: getStepAction(step),
    coachTitle: normalizeText(feedbackPayload.coachTitle) || "Coach feedback",
    coachMessage:
      normalizeText(feedbackPayload.coachMessage) ||
      "Keep working one step at a time so the answer matches the question.",
    checklist: normalizeTextList(feedbackPayload.checklist),
    suggestedStarter:
      normalizeText(feedbackPayload.suggestedStarter) || null,
    result: normalizeText(feedbackPayload.result) || step.result || "keep_working",
    readyToSubmit: feedbackPayload.readyToSubmit === true,
  };
}

function hasAdvanceResult(step: HomeworkStepLike) {
  const feedbackPayload = (step.feedbackPayload ?? {}) as {
    shouldAdvance?: unknown;
  };

  return step.result === "completed" || feedbackPayload.shouldAdvance === true;
}

function getLatestDraftFromStep(step: HomeworkStepLike) {
  const studentAnswer = (step.studentAnswer ?? {}) as { text?: unknown };
  return normalizeText(studentAnswer.text);
}

export function inferHomeworkContentShape({
  rawText,
  questionCount,
}: {
  rawText: string;
  questionCount: number;
}): HomeworkContentShape {
  const normalized = rawText.toLowerCase();
  const looksLikePassage =
    /\b(passage|article|excerpt|text below|read the text|read the passage|story)\b/.test(
      normalized
    ) && questionCount > 0;

  if (questionCount <= 1) {
    return "single_question";
  }

  if (looksLikePassage) {
    return "passage_plus_questions";
  }

  if (questionCount > 1) {
    return "multi_question";
  }

  return "mixed_or_unclear";
}

export function getHomeworkConfidenceState({
  status,
  questionCount,
}: {
  status: string;
  questionCount: number;
}): HomeworkConfidenceState {
  if (status === "failed" || questionCount === 0) {
    return "blocked";
  }

  if (status === "needs_review") {
    return "warning";
  }

  return "ready";
}

export function createInitialHomeworkSessionState(questionCount: number): HomeworkSessionState {
  return {
    currentQuestionIndex: 0,
    questionStates: Array.from({ length: questionCount }, (_, index) =>
      getQuestionStateDefaults(index)
    ),
  };
}

export function getRecommendedHomeworkAction(
  questionState: Pick<
    HomeworkQuestionState,
    "status" | "latestDraft" | "coachEntries" | "hintLevel"
  >
): HomeworkCoachAction {
  if (questionState.status === "completed" || questionState.status === "ready_to_submit") {
    return "submit";
  }

  const draftWordCount = getDraftWordCount(questionState.latestDraft);
  const coachEntries = questionState.coachEntries;

  if (draftWordCount === 0) {
    if (coachEntries.length === 0) {
      return "explain";
    }

    const lastAction = coachEntries[coachEntries.length - 1]?.action;

    if (lastAction === "explain") {
      return "plan";
    }

    return "hint";
  }

  if (!coachEntries.some((entry) => entry.action === "check" || entry.readyToSubmit)) {
    return "check";
  }

  if (questionState.hintLevel >= 2 && draftWordCount < 18) {
    return "check";
  }

  return "submit";
}

export function hydrateHomeworkSessionState({
  questions,
  savedState,
  steps,
}: {
  questions: HomeworkQuestionLike[];
  savedState: unknown;
  steps: HomeworkStepLike[];
}): HomeworkSessionState {
  const initial = createInitialHomeworkSessionState(questions.length);
  const rawSavedState =
    savedState && typeof savedState === "object"
      ? (savedState as Partial<HomeworkSessionState>)
      : null;

  const mergedQuestionStates = initial.questionStates.map((state, index) => {
    const savedQuestionState = rawSavedState?.questionStates?.[index];
    const nextState: HomeworkQuestionState = {
      ...state,
      status:
        savedQuestionState?.status === "in_progress" ||
        savedQuestionState?.status === "ready_to_submit" ||
        savedQuestionState?.status === "completed"
          ? savedQuestionState.status
          : "not_started",
      latestDraft: normalizeText(savedQuestionState?.latestDraft),
      hintLevel:
        typeof savedQuestionState?.hintLevel === "number"
          ? Math.max(0, savedQuestionState.hintLevel)
          : 0,
      recommendedAction:
        savedQuestionState?.recommendedAction === "plan" ||
        savedQuestionState?.recommendedAction === "hint" ||
        savedQuestionState?.recommendedAction === "check" ||
        savedQuestionState?.recommendedAction === "submit"
          ? savedQuestionState.recommendedAction
          : "explain",
      coachEntries: Array.isArray(savedQuestionState?.coachEntries)
        ? savedQuestionState.coachEntries.map((entry) => ({
            action:
              entry?.action === "plan" ||
              entry?.action === "hint" ||
              entry?.action === "check" ||
              entry?.action === "submit"
                ? entry.action
                : "explain",
            coachTitle: normalizeText(entry?.coachTitle) || "Coach feedback",
            coachMessage:
              normalizeText(entry?.coachMessage) ||
              "Keep working one step at a time so the answer matches the question.",
            checklist: normalizeTextList(entry?.checklist),
            suggestedStarter: normalizeText(entry?.suggestedStarter) || null,
            result: normalizeText(entry?.result) || "keep_working",
            readyToSubmit: entry?.readyToSubmit === true,
          }))
        : [],
    };

    const stepEntries = steps
      .filter((step) => step.questionIndex === index)
      .map((step) => createCoachEntryFromStep(step));

    if (nextState.coachEntries.length === 0 && stepEntries.length > 0) {
      nextState.coachEntries = stepEntries;
    }

    const latestStepDraft = steps
      .filter((step) => step.questionIndex === index)
      .map((step) => getLatestDraftFromStep(step))
      .filter(Boolean)
      .at(-1);

    if (!nextState.latestDraft && latestStepDraft) {
      nextState.latestDraft = latestStepDraft;
    }

    const stepHintLevel = steps
      .filter((step) => step.questionIndex === index)
      .reduce((max, step) => Math.max(max, step.hintLevelUsed), 0);

    nextState.hintLevel = Math.max(nextState.hintLevel, stepHintLevel);

    const isCompleted = steps.some(
      (step) => step.questionIndex === index && hasAdvanceResult(step)
    );
    const isReadyToSubmit =
      !isCompleted &&
      nextState.coachEntries.some((entry) => entry.readyToSubmit === true);

    if (isCompleted) {
      nextState.status = "completed";
    } else if (isReadyToSubmit) {
      nextState.status = "ready_to_submit";
    } else if (nextState.latestDraft || nextState.coachEntries.length > 0) {
      nextState.status = "in_progress";
    }

    nextState.recommendedAction = getRecommendedHomeworkAction(nextState);
    return nextState;
  });

  const nextCurrentQuestionIndex =
    typeof rawSavedState?.currentQuestionIndex === "number" &&
    mergedQuestionStates[rawSavedState.currentQuestionIndex]
      ? rawSavedState.currentQuestionIndex
      : mergedQuestionStates.findIndex((state) => state.status !== "completed");

  return {
    currentQuestionIndex:
      nextCurrentQuestionIndex >= 0
        ? nextCurrentQuestionIndex
        : Math.max(mergedQuestionStates.length - 1, 0),
    questionStates: mergedQuestionStates,
  };
}

export function buildHomeworkCompletionSummary({
  questions,
  state,
}: {
  questions: HomeworkQuestionLike[];
  state: HomeworkSessionState;
}): HomeworkCompletionSummary {
  const completedCount = state.questionStates.filter(
    (questionState) => questionState.status === "completed"
  ).length;
  const totalHints = state.questionStates.reduce(
    (sum, questionState) => sum + questionState.hintLevel,
    0
  );
  const coachActions = state.questionStates.flatMap((questionState) =>
    questionState.coachEntries.map((entry) => entry.action)
  );
  const mostUsedAction = (["explain", "plan", "hint", "check"] as const)
    .map((action) => ({
      action,
      count: coachActions.filter((usedAction) => usedAction === action).length,
    }))
    .sort((left, right) => right.count - left.count)[0]?.action;

  const handledWell =
    questions.length <= 1
      ? "You stayed with one question until it was ready to turn in."
      : `You kept ${completedCount} question${completedCount === 1 ? "" : "s"} moving instead of getting stuck on a single part of the assignment.`;

  const watchNextTime =
    totalHints >= Math.max(questions.length, 2)
      ? "Make a quick plan before you draft so you need fewer rescue hints later."
      : "Before you submit, reread the question and make sure every part is answered directly.";

  let strategyThatHelped =
    "Working one question at a time helped keep the assignment manageable.";

  if (mostUsedAction === "explain") {
    strategyThatHelped =
      "Breaking the question down first helped you get clear before drafting.";
  } else if (mostUsedAction === "plan") {
    strategyThatHelped =
      "Making a short plan first helped you turn the prompt into a usable answer structure.";
  } else if (mostUsedAction === "hint") {
    strategyThatHelped =
      "Using one hint at a time helped you keep moving without giving the whole answer away.";
  } else if (mostUsedAction === "check") {
    strategyThatHelped =
      "Checking the draft before submitting helped you catch missing details early.";
  }

  return {
    handledWell,
    watchNextTime,
    strategyThatHelped,
  };
}
