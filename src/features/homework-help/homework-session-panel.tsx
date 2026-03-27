"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Lightbulb,
  ListChecks,
  MessageSquareQuote,
  SearchCheck,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  buildHomeworkCompletionSummary,
  getRecommendedHomeworkAction,
  type HomeworkCoachAction,
  type HomeworkCompletionSummary,
  type HomeworkConfidenceState,
  type HomeworkContentShape,
  type HomeworkQuestionState,
  type HomeworkSessionState,
} from "@/lib/homework-help";

type HomeworkQuestion = {
  index: number;
  promptText: string;
  questionType: string;
  focusSkill?: string;
  studentGoal?: string;
  answerFormat?: string;
  successCriteria?: string[];
  planSteps?: string[];
  commonPitfalls?: string[];
};

type HomeworkSessionPanelProps = {
  sessionId: string;
  sessionStatus: string;
  assignmentTitle: string;
  assignmentSummary: string;
  subject: string;
  difficultyLevel: string;
  contentShape: HomeworkContentShape | string;
  confidenceState: HomeworkConfidenceState;
  reviewNotes: string[];
  rawText: string;
  questions: HomeworkQuestion[];
  initialSessionState: HomeworkSessionState;
  completionSummary: HomeworkCompletionSummary;
};

type HomeworkStepResponse = {
  result?: string;
  coachTitle?: string;
  coachMessage?: string;
  checklist?: string[];
  suggestedStarter?: string | null;
  shouldAdvance?: boolean;
  readyToSubmit?: boolean;
  sessionCompleted?: boolean;
  recommendedAction?: HomeworkCoachAction;
  questionStatus?: HomeworkQuestionState["status"];
  currentQuestionIndex?: number;
  completionSummary?: HomeworkCompletionSummary | null;
  message?: string;
  error?: { message?: string };
};

function getActionMeta(action: HomeworkCoachAction) {
  switch (action) {
    case "explain":
      return {
        label: "Understand the question",
        secondaryLabel: "Break it down",
        icon: MessageSquareQuote,
      };
    case "plan":
      return {
        label: "Make a plan",
        secondaryLabel: "Make a plan",
        icon: ListChecks,
      };
    case "hint":
      return {
        label: "Get a hint",
        secondaryLabel: "Get a hint",
        icon: Lightbulb,
      };
    case "check":
      return {
        label: "Check my draft",
        secondaryLabel: "Check my draft",
        icon: SearchCheck,
      };
    case "submit":
      return {
        label: "Ready to submit",
        secondaryLabel: "Submit",
        icon: ArrowRight,
      };
    default:
      return {
        label: "Continue",
        secondaryLabel: "Continue",
        icon: ArrowRight,
      };
  }
}

function getWorkspaceLabel(questionCount: number, contentShape: HomeworkContentShape | string) {
  if (questionCount === 1 || contentShape === "single_question") {
    return "Current task";
  }

  return "Current question";
}

function getProgressLabel(questionCount: number, completedCount: number) {
  if (questionCount <= 1) {
    return completedCount >= 1 ? "Task complete" : "1 task";
  }

  return `${completedCount} of ${questionCount}`;
}

function getConfidenceNote(confidenceState: HomeworkConfidenceState, reviewNotes: string[]) {
  if (confidenceState !== "warning") {
    return null;
  }

  return reviewNotes[0] ?? "This question map was low-confidence, so double-check the prompt as you work.";
}

function buildInitialSummary(summary: HomeworkCompletionSummary) {
  return summary;
}

export function HomeworkSessionPanel({
  sessionId,
  sessionStatus,
  assignmentTitle,
  assignmentSummary,
  subject,
  difficultyLevel,
  contentShape,
  confidenceState,
  reviewNotes,
  rawText,
  questions,
  initialSessionState,
  completionSummary,
}: HomeworkSessionPanelProps) {
  const [questionStates, setQuestionStates] = useState(initialSessionState.questionStates);
  const [currentIndex, setCurrentIndex] = useState(initialSessionState.currentQuestionIndex);
  const [pendingAction, setPendingAction] = useState<HomeworkCoachAction | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [completed, setCompleted] = useState(
    sessionStatus === "completed" ||
      initialSessionState.questionStates.every((questionState) => questionState.status === "completed")
  );
  const [summary, setSummary] = useState(buildInitialSummary(completionSummary));
  const autosaveInitialized = useRef(false);

  const currentQuestion = useMemo(() => questions[currentIndex], [currentIndex, questions]);
  const currentQuestionState = useMemo(
    () => questionStates[currentIndex],
    [currentIndex, questionStates]
  );
  const currentDraft = currentQuestionState?.latestDraft ?? "";
  const currentFeed = currentQuestionState?.coachEntries ?? [];
  const completedCount = questionStates.filter(
    (questionState) => questionState.status === "completed"
  ).length;
  const progressValue =
    questions.length === 0 ? 0 : Math.round((completedCount / questions.length) * 100);
  const recommendedAction = currentQuestionState?.recommendedAction ?? "explain";
  const showQuestionMap = questions.length > 1 && contentShape !== "single_question";
  const confidenceNote = getConfidenceNote(confidenceState, reviewNotes);

  async function persistSessionState({
    questionIndex,
    latestDraft,
    nextCurrentQuestionIndex,
  }: {
    questionIndex: number;
    latestDraft: string;
    nextCurrentQuestionIndex: number;
  }) {
    const response = await fetch("/api/v1/learn/homework/session/state", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        questionIndex,
        latestDraft,
        currentQuestionIndex: nextCurrentQuestionIndex,
      }),
    });

    if (!response.ok) {
      throw new Error("Autosave failed.");
    }
  }

  useEffect(() => {
    if (completed || !questions[currentIndex]) {
      return;
    }

    if (!autosaveInitialized.current) {
      autosaveInitialized.current = true;
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setSaveStatus("Saving...");
        await persistSessionState({
          questionIndex: currentIndex,
          latestDraft: currentDraft,
          nextCurrentQuestionIndex: currentIndex,
        });

        setSaveStatus("Saved");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setSaveStatus(
          error instanceof Error ? error.message : "Autosave failed."
        );
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [completed, currentDraft, currentIndex, questions, sessionId]);

  function updateDraft(nextValue: string) {
    setQuestionStates((value) =>
      value.map((questionState, index) => {
        if (index !== currentIndex) {
          return questionState;
        }

        const nextState: HomeworkQuestionState = {
          ...questionState,
          latestDraft: nextValue,
          status:
            questionState.status === "completed"
              ? "completed"
              : nextValue.trim()
                ? "in_progress"
                : "not_started",
        };
        nextState.recommendedAction = getRecommendedHomeworkAction(nextState);
        return nextState;
      })
    );
  }

  function jumpToQuestion(index: number) {
    void persistSessionState({
      questionIndex: currentIndex,
      latestDraft: currentDraft,
      nextCurrentQuestionIndex: index,
    })
      .then(() => {
        setSaveStatus("Saved");
      })
      .catch(() => {
        setSaveStatus("Autosave failed.");
      });
    setCurrentIndex(index);
    setErrorText(null);
    setStatusText(null);
  }

  async function runCoachAction(action: HomeworkCoachAction) {
    if (!currentQuestion || !currentQuestionState || pendingAction) {
      return;
    }

    if ((action === "check" || action === "submit") && !currentDraft.trim()) {
      setErrorText("Write a draft first so Homework Help has something to check.");
      return;
    }

    setPendingAction(action);
    setErrorText(null);
    setStatusText(null);

    try {
      const response = await fetch("/api/v1/learn/homework/session/step", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          questionIndex: currentIndex,
          studentAnswer: currentDraft,
          action,
        }),
      });
      const payload = (await response.json()) as HomeworkStepResponse;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
            payload.message ??
            "Homework Help could not process that step."
        );
      }

      setQuestionStates((value) =>
        value.map((questionState, index) => {
          if (index !== currentIndex) {
            return questionState;
          }

          const nextState: HomeworkQuestionState = {
            ...questionState,
            latestDraft: currentDraft,
            hintLevel:
              action === "hint"
                ? Math.min(questionState.hintLevel + 1, 3)
                : questionState.hintLevel,
            coachEntries: [
              ...questionState.coachEntries,
              {
                action,
                coachTitle: payload.coachTitle ?? "Coach feedback",
                coachMessage:
                  payload.coachMessage ??
                  "Keep improving the answer so it fully matches the question.",
                checklist: payload.checklist ?? [],
                suggestedStarter: payload.suggestedStarter ?? null,
                result: payload.result ?? "keep_working",
                readyToSubmit: Boolean(payload.readyToSubmit),
              },
            ],
            status:
              payload.questionStatus ??
              (payload.shouldAdvance
                ? "completed"
                : payload.readyToSubmit
                  ? "ready_to_submit"
                  : currentDraft.trim()
                    ? "in_progress"
                    : "not_started"),
            recommendedAction:
              payload.recommendedAction ?? questionState.recommendedAction,
          };

          if (!payload.recommendedAction) {
            nextState.recommendedAction = getRecommendedHomeworkAction(nextState);
          }

          return nextState;
        })
      );

      if (payload.sessionCompleted) {
        setCompleted(true);
        setSummary(
          payload.completionSummary ??
            buildHomeworkCompletionSummary({
              questions,
              state: {
                currentQuestionIndex: currentIndex,
                questionStates: questionStates.map((questionState, index) =>
                  index === currentIndex
                    ? {
                        ...questionState,
                        latestDraft: currentDraft,
                        status: payload.questionStatus ?? "completed",
                        coachEntries: [
                          ...questionState.coachEntries,
                          {
                            action,
                            coachTitle: payload.coachTitle ?? "Coach feedback",
                            coachMessage:
                              payload.coachMessage ??
                              "Keep improving the answer so it fully matches the question.",
                            checklist: payload.checklist ?? [],
                            suggestedStarter: payload.suggestedStarter ?? null,
                            result: payload.result ?? "keep_working",
                            readyToSubmit: Boolean(payload.readyToSubmit),
                          },
                        ],
                        recommendedAction: payload.recommendedAction ?? "submit",
                      }
                    : questionState
                ),
              },
            })
        );
        setStatusText("Homework complete. You worked through every part of it.");
      } else if (typeof payload.currentQuestionIndex === "number") {
        setCurrentIndex(payload.currentQuestionIndex);
      }

      if (payload.readyToSubmit && !payload.sessionCompleted) {
        setStatusText("This looks ready. Submit it when you want to move on.");
      } else if (payload.shouldAdvance && !payload.sessionCompleted) {
        const nextQuestionNumber = questions[payload.currentQuestionIndex ?? currentIndex]?.index;
        setStatusText(
          nextQuestionNumber
            ? `That step is done. Move to question ${nextQuestionNumber}.`
            : "That step is done."
        );
      }
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Homework Help could not process that step."
      );
    } finally {
      setPendingAction(null);
    }
  }

  if (questions.length === 0) {
    return (
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-2xl">Homework session unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We could not recover usable questions from this upload. Try a clearer file or
            paste the homework text directly.
          </p>
          <Button asChild>
            <Link href="/app/tools/homework">Return to Homework Help</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="surface-glow border-border/70 bg-card/95">
        <CardHeader className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
              Homework Help
            </p>
            <CardTitle className="text-2xl leading-tight sm:text-3xl">
              {assignmentTitle}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {subject} · {difficultyLevel}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="font-semibold text-foreground">
                {completed
                  ? "Homework complete"
                  : getProgressLabel(questions.length, completedCount)}
              </p>
              <p className="text-muted-foreground">{progressValue}%</p>
            </div>
            <Progress value={progressValue} className="h-2.5" />
          </div>
        </CardHeader>
      </Card>

      {completed ? (
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">Homework complete</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {questions.length === 1
                ? "You worked this question all the way through."
                : "You worked through the whole assignment one step at a time."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-[1.2rem] border border-border/70 bg-background/70 px-4 py-4 sm:rounded-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                  What you handled well
                </p>
                <p className="mt-3 text-sm leading-6 text-foreground">
                  {summary.handledWell}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-border/70 bg-background/70 px-4 py-4 sm:rounded-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                  What to watch next time
                </p>
                <p className="mt-3 text-sm leading-6 text-foreground">
                  {summary.watchNextTime}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-border/70 bg-background/70 px-4 py-4 sm:rounded-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                  Strategy that helped
                </p>
                <p className="mt-3 text-sm leading-6 text-foreground">
                  {summary.strategyThatHelped}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/app/tools/homework">
                  Start another homework
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/app/tools">Return to Tools</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-border/70 bg-card/95">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                    {getWorkspaceLabel(questions.length, contentShape)}
                  </p>
                  <CardTitle className="text-2xl">
                    {questions.length === 1 || contentShape === "single_question"
                      ? "Work through this question"
                      : `Question ${currentQuestion.index}`}
                  </CardTitle>
                </div>
                <span className="rounded-full border border-border/70 bg-muted/20 px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {currentQuestion.focusSkill ?? currentQuestion.questionType}
                </span>
              </div>

              <div className="rounded-[1.25rem] border border-border/70 bg-background/70 px-4 py-4 sm:rounded-3xl sm:px-5 sm:py-5">
                <p className="text-[0.96rem] leading-7 text-foreground sm:text-base">
                  {currentQuestion.promptText}
                </p>
              </div>

              {confidenceNote ? (
                <div className="rounded-[1.15rem] border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-800 sm:rounded-3xl">
                  {confidenceNote}
                </div>
              ) : null}
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[1.2rem] border border-border/70 bg-background/70 px-4 py-4 sm:rounded-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                    What a good answer should include
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-foreground">
                    {(currentQuestion.successCriteria ?? []).map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[1.2rem] border border-border/70 bg-background/70 px-4 py-4 sm:rounded-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                    Recommended next step
                  </p>
                  <p className="mt-3 text-base font-semibold text-foreground">
                    {getActionMeta(recommendedAction).label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {recommendedAction === "explain"
                      ? "Use this first if the prompt feels unclear."
                      : recommendedAction === "plan"
                        ? "Turn the prompt into a simple answer structure before drafting."
                        : recommendedAction === "hint"
                          ? "Get one nudge to keep moving without giving the answer away."
                          : recommendedAction === "check"
                            ? "See what your draft still needs before you submit."
                            : "Move on when the answer covers the core task."}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Workspace</p>
                  <p className="text-xs text-muted-foreground">{saveStatus ?? " "}</p>
                </div>
                <Textarea
                  rows={9}
                  value={currentDraft}
                  onChange={(event) => updateDraft(event.target.value)}
                  placeholder="Write your answer here. Homework Help will guide the next step."
                />
              </div>

              <div className="space-y-3">
                <Button
                  type="button"
                  size="lg"
                  className="w-full justify-center"
                  onClick={() => runCoachAction(recommendedAction)}
                  disabled={pendingAction !== null}
                >
                  {pendingAction === recommendedAction
                    ? "Working..."
                    : getActionMeta(recommendedAction).label}
                  <ArrowRight className="size-4" />
                </Button>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {(["explain", "plan", "hint", "check", "submit"] as HomeworkCoachAction[])
                    .filter((action) => action !== recommendedAction)
                    .map((action) => {
                      const actionMeta = getActionMeta(action);
                      const ActionIcon = actionMeta.icon;

                      return (
                        <Button
                          key={action}
                          type="button"
                          variant="outline"
                          onClick={() => runCoachAction(action)}
                          disabled={pendingAction !== null}
                          className="h-auto min-h-11 justify-start px-3 py-3 text-sm"
                        >
                          <ActionIcon className="size-4" />
                          {actionMeta.secondaryLabel}
                        </Button>
                      );
                    })}
                </div>
              </div>

              {statusText ? (
                <div className="rounded-[1.2rem] border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-700 sm:rounded-3xl">
                  {statusText}
                </div>
              ) : null}

              {errorText ? (
                <div className="rounded-[1.2rem] border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive sm:rounded-3xl">
                  {errorText}
                </div>
              ) : null}

              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Coach feed</p>
                {currentFeed.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground sm:rounded-3xl">
                    Start with <span className="font-semibold text-foreground">Understand the question</span>{" "}
                    if the prompt is unclear. If you already know what it wants, jump to{" "}
                    <span className="font-semibold text-foreground">Make a plan</span>.
                  </div>
                ) : (
                  currentFeed.map((entry, index) => (
                    <div
                      key={`${entry.action}-${index}`}
                      className="rounded-[1.2rem] border border-border/70 bg-background/70 px-4 py-4 sm:rounded-3xl"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          {entry.coachTitle}
                        </p>
                        <span className="rounded-full bg-secondary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">
                          {getActionMeta(entry.action).secondaryLabel}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {entry.coachMessage}
                      </p>
                      {entry.checklist.length > 0 ? (
                        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                          {entry.checklist.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                      {entry.suggestedStarter ? (
                        <div className="mt-3 rounded-[1rem] border border-border/70 bg-muted/20 px-3 py-3 text-sm text-foreground sm:rounded-2xl">
                          Suggested starter: {entry.suggestedStarter}
                        </div>
                      ) : null}
                      {entry.readyToSubmit ? (
                        <p className="mt-3 text-sm font-semibold text-emerald-700">
                          This looks ready to submit.
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4 sm:space-y-6">
            <Card className="border-border/70 bg-card/95">
              <CardHeader>
                <CardTitle className="text-xl">Assignment snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-[1.2rem] border border-border/70 bg-background/70 px-4 py-4 sm:rounded-3xl">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {assignmentSummary}
                  </p>
                </div>

                {showQuestionMap ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                      Question map
                    </p>
                    {questions.map((question, index) => {
                      const isComplete = questionStates[index]?.status === "completed";
                      const isCurrent = index === currentIndex;

                      return (
                        <button
                          key={`${question.index}-${question.promptText}`}
                          type="button"
                          onClick={() => jumpToQuestion(index)}
                          className={`w-full rounded-[1.2rem] border px-4 py-4 text-left transition sm:rounded-3xl ${
                            isCurrent
                              ? "border-primary/40 bg-primary/8"
                              : "border-border/70 bg-muted/20 hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                                Question {question.index}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-foreground">
                                {question.promptText}
                              </p>
                            </div>
                            {isComplete ? (
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[1.2rem] border border-border/70 bg-muted/20 px-4 py-4 text-sm leading-6 text-muted-foreground sm:rounded-3xl">
                    This workspace stays focused on one question so you can keep the answer clear.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/95">
              <CardHeader>
                <CardTitle className="text-xl">Source homework</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="source" className="border-none">
                    <AccordionTrigger className="rounded-[1.1rem] border border-border/70 bg-muted/20 px-4 py-3 text-left text-sm font-semibold text-foreground hover:no-underline sm:rounded-3xl">
                      <span className="inline-flex items-center gap-2">
                        <BookOpenText className="size-4 text-secondary" />
                        Show the uploaded text
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pt-3">
                      <div className="rounded-[1.2rem] border border-border/70 bg-background/70 px-4 py-4 text-sm leading-6 text-muted-foreground sm:rounded-3xl">
                        {rawText}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
