"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
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

type CoachEntry = {
  action: HomeworkCoachAction;
  coachTitle: string;
  coachMessage: string;
  checklist: string[];
  suggestedStarter: string | null;
  result: string;
  readyToSubmit: boolean;
};

type HomeworkCoachAction = "explain" | "plan" | "hint" | "check" | "submit";

type HomeworkSessionPanelProps = {
  sessionId: string;
  sessionStatus: string;
  assignmentTitle: string;
  assignmentSummary: string;
  subject: string;
  difficultyLevel: string;
  reviewNotes: string[];
  rawText: string;
  questions: HomeworkQuestion[];
  completedQuestionIndices: number[];
};

function getActionCopy(action: HomeworkCoachAction) {
  switch (action) {
    case "explain":
      return { idle: "Break it down", busy: "Breaking it down..." };
    case "plan":
      return { idle: "Make a plan", busy: "Building plan..." };
    case "hint":
      return { idle: "Next hint", busy: "Getting hint..." };
    case "check":
      return { idle: "Check my work", busy: "Checking draft..." };
    case "submit":
      return { idle: "Submit step", busy: "Submitting..." };
    default:
      return { idle: "Continue", busy: "Working..." };
  }
}

function getActionPill(action: HomeworkCoachAction) {
  switch (action) {
    case "explain":
      return "Breakdown";
    case "plan":
      return "Plan";
    case "hint":
      return "Hint";
    case "check":
      return "Draft check";
    case "submit":
      return "Submit";
    default:
      return "Coach";
  }
}

export function HomeworkSessionPanel({
  sessionId,
  sessionStatus,
  assignmentTitle,
  assignmentSummary,
  subject,
  difficultyLevel,
  reviewNotes,
  rawText,
  questions,
  completedQuestionIndices,
}: HomeworkSessionPanelProps) {
  const initialIndex = useMemo(() => {
    const nextIndex = questions.findIndex(
      (_, index) => !completedQuestionIndices.includes(index)
    );

    if (nextIndex !== -1) {
      return nextIndex;
    }

    return questions.length > 0 ? questions.length - 1 : 0;
  }, [completedQuestionIndices, questions]);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [coachFeed, setCoachFeed] = useState<Record<number, CoachEntry[]>>({});
  const [pendingAction, setPendingAction] = useState<HomeworkCoachAction | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [completedSet, setCompletedSet] = useState<number[]>(completedQuestionIndices);
  const [completed, setCompleted] = useState(
    sessionStatus === "completed" || completedQuestionIndices.length >= questions.length
  );

  const currentQuestion = useMemo(() => questions[currentIndex], [currentIndex, questions]);
  const currentDraft = drafts[currentIndex] ?? "";
  const currentFeed = coachFeed[currentIndex] ?? [];
  const progressValue =
    questions.length === 0 ? 0 : Math.round((completedSet.length / questions.length) * 100);

  async function runCoachAction(action: HomeworkCoachAction) {
    if (!currentQuestion || pendingAction) {
      return;
    }

    if ((action === "check" || action === "submit") && !currentDraft.trim()) {
      setErrorText("Write a draft first so the coach has something to work with.");
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
      const payload = (await response.json()) as {
        result?: string;
        coachTitle?: string;
        coachMessage?: string;
        checklist?: string[];
        suggestedStarter?: string | null;
        shouldAdvance?: boolean;
        readyToSubmit?: boolean;
        sessionCompleted?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "The coach could not process that step.");
      }

      const coachEntry: CoachEntry = {
        action,
        coachTitle: payload.coachTitle ?? "Coach feedback",
        coachMessage:
          payload.coachMessage ?? "Keep refining the answer so it fully matches the prompt.",
        checklist: payload.checklist ?? [],
        suggestedStarter: payload.suggestedStarter ?? null,
        result: payload.result ?? "keep_working",
        readyToSubmit: Boolean(payload.readyToSubmit),
      };

      setCoachFeed((value) => ({
        ...value,
        [currentIndex]: [...(value[currentIndex] ?? []), coachEntry],
      }));

      if (payload.shouldAdvance) {
        const nextCompleted = Array.from(new Set([...completedSet, currentIndex])).sort(
          (a, b) => a - b
        );
        setCompletedSet(nextCompleted);

        const nextIndex = questions.findIndex((_, index) => !nextCompleted.includes(index));
        if (payload.sessionCompleted || nextIndex === -1) {
          setCompleted(true);
          setStatusText("Assignment complete. You worked through every question.");
          return;
        }

        setCurrentIndex(nextIndex);
        setStatusText(
          `Question ${currentQuestion.index} is done. Now move to question ${questions[nextIndex]?.index}.`
        );
        return;
      }

      if (payload.readyToSubmit) {
        setStatusText("This looks ready. Submit the step when you want to move on.");
      }
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "The coach could not process that step."
      );
    } finally {
      setPendingAction(null);
    }
  }

  function updateDraft(nextValue: string) {
    setDrafts((value) => ({
      ...value,
      [currentIndex]: nextValue,
    }));
  }

  function jumpToQuestion(index: number) {
    setCurrentIndex(index);
    setErrorText(null);
    setStatusText(null);
  }

  if (questions.length === 0) {
    return (
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-2xl">Homework session unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We could not recover any guided questions from this upload. Try a clearer file
            or paste the assignment text directly.
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
            <CardTitle className="text-2xl leading-tight sm:text-3xl">{assignmentTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {subject} · {difficultyLevel}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="font-semibold text-foreground">
                {completed ? "Assignment complete" : `${completedSet.length} of ${questions.length}`}
              </p>
              <p className="text-muted-foreground">{progressValue}%</p>
            </div>
            <Progress value={progressValue} className="h-2.5" />
          </div>
        </CardHeader>
      </Card>

      {completed ? (
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-2xl">All done</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You worked through every question in this assignment.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/app/tools/homework">
                  Start another assignment
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
        <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4 sm:space-y-6">
            <Card className="border-border/70 bg-card/95">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                      Current question
                    </p>
                    <CardTitle className="mt-2 text-2xl">
                      Question {currentQuestion.index}
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
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Workspace</p>
                  <Textarea
                    rows={9}
                    value={currentDraft}
                    onChange={(event) => updateDraft(event.target.value)}
                    placeholder="Work through your answer here. The coach can help you break it down, plan it, check it, and submit it."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => runCoachAction("explain")}
                    disabled={pendingAction !== null}
                    className="h-auto min-h-11 justify-start px-3 py-3 text-sm sm:justify-center"
                  >
                    <MessageSquareQuote className="size-4" />
                    {pendingAction === "explain"
                      ? getActionCopy("explain").busy
                      : getActionCopy("explain").idle}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => runCoachAction("plan")}
                    disabled={pendingAction !== null}
                    className="h-auto min-h-11 justify-start px-3 py-3 text-sm sm:justify-center"
                  >
                    <ListChecks className="size-4" />
                    {pendingAction === "plan"
                      ? getActionCopy("plan").busy
                      : getActionCopy("plan").idle}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => runCoachAction("hint")}
                    disabled={pendingAction !== null}
                    className="h-auto min-h-11 justify-start px-3 py-3 text-sm sm:justify-center"
                  >
                    <Lightbulb className="size-4" />
                    {pendingAction === "hint"
                      ? getActionCopy("hint").busy
                      : getActionCopy("hint").idle}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => runCoachAction("check")}
                    disabled={pendingAction !== null}
                    className="h-auto min-h-11 justify-start px-3 py-3 text-sm sm:justify-center"
                  >
                    <SearchCheck className="size-4" />
                    {pendingAction === "check"
                      ? getActionCopy("check").busy
                      : getActionCopy("check").idle}
                  </Button>
                  <Button
                    type="button"
                    className="col-span-2 h-auto min-h-11 justify-center px-3 py-3 text-sm sm:col-span-2 xl:col-span-2"
                    onClick={() => runCoachAction("submit")}
                    disabled={pendingAction !== null}
                  >
                    {pendingAction === "submit"
                      ? getActionCopy("submit").busy
                      : getActionCopy("submit").idle}
                    <ArrowRight className="size-4" />
                  </Button>
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
                      Start with <span className="font-semibold text-foreground">Break it down</span>{" "}
                      if the prompt is confusing, or <span className="font-semibold text-foreground">Make a plan</span>{" "}
                      if you know what the question wants but need a structure.
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
                            {getActionPill(entry.action)}
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
                            This draft looks ready for submission.
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <Card className="border-border/70 bg-card/95">
              <CardHeader>
                <CardTitle className="text-xl">Question map</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {questions.map((question, index) => {
                  const isComplete = completedSet.includes(index);
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
              </CardContent>
            </Card>

            {reviewNotes.length > 0 ? (
              <Card className="border-border/70 bg-card/95">
                <CardHeader>
                  <CardTitle className="text-xl">Parse review note</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{reviewNotes[0]}</p>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-border/70 bg-card/95">
              <CardHeader>
                <CardTitle className="text-xl">Source assignment</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible defaultValue="summary">
                  <AccordionItem value="summary">
                    <AccordionTrigger>Assignment summary</AccordionTrigger>
                    <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                      <p>{assignmentSummary}</p>
                      <p>
                        Current question goal:{" "}
                        {currentQuestion.studentGoal ??
                          "Answer the full prompt clearly and directly."}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="source">
                    <AccordionTrigger>Full assignment text</AccordionTrigger>
                    <AccordionContent>
                      <pre className="max-h-[24rem] overflow-auto whitespace-pre-wrap rounded-[1.2rem] border border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground sm:rounded-3xl">
                        {rawText}
                      </pre>
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
