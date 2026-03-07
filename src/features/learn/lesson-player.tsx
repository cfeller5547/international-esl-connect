"use client";

import { useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LearnActivityTransition,
  useLearnActivityCompletion,
} from "@/features/learn/learn-activity-transition";

type LessonPlayerProps = {
  lessonId: string;
  unitTitle: string;
  sections: Array<{ title: string; body: string }>;
  checks: Array<{ prompt: string; options: string[]; correctIndex: number }>;
  completionRequest?: {
    endpoint: string;
    body: Record<string, unknown>;
    buttonLabel?: string;
    fallbackHref?: string;
  };
};

export function LessonPlayer({
  lessonId,
  unitTitle,
  sections,
  checks,
  completionRequest,
}: LessonPlayerProps) {
  const [mode, setMode] = useState<"overview" | "check">("overview");
  const [checkIndex, setCheckIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const { pending, error, completionState, complete } = useLearnActivityCompletion({
    endpoint: completionRequest?.endpoint ?? "/api/v1/learn/activity/complete",
    fallbackHref: completionRequest?.fallbackHref ?? "/app/learn",
    activityType: "lesson",
    unitTitle,
  });

  const currentCheck = checks[checkIndex];
  const currentCheckAnswered = currentCheck
    ? answers[checkIndex] !== undefined
    : true;

  const score = checks.length
    ? Math.round(
        (checks.filter((check, index) => answers[index] === String(check.correctIndex)).length /
          checks.length) *
          100
      )
    : 100;

  async function finishLesson() {
    await complete({
      score,
      ...(completionRequest?.body ?? {
        activityType: "lesson",
        activityId: lessonId,
        metadata: { unitTitle },
      }),
    });
  }

  async function handleContinue() {
    if (mode === "overview") {
      if (checks.length > 0) {
        setMode("check");
        return;
      }

      await finishLesson();
      return;
    }

    if (checkIndex < checks.length - 1) {
      setCheckIndex((current) => current + 1);
      return;
    }

    await finishLesson();
  }

  function handleBack() {
    if (mode === "check" && checkIndex > 0) {
      setCheckIndex((current) => current - 1);
      return;
    }

    if (mode === "check") {
      setMode("overview");
    }
  }

  if (completionState) {
    return <LearnActivityTransition state={completionState} />;
  }

  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="space-y-3">
        {mode === "overview" ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              Lesson overview
            </p>
            <CardTitle className="text-2xl">What to notice before you begin</CardTitle>
            <p className="text-sm text-muted-foreground">
              Review the key ideas once, then move into a short quick check.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              Quick check
            </p>
            <CardTitle className="text-2xl">
              Check {checkIndex + 1} of {checks.length}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Answer this question, then continue.
            </p>
          </>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {mode === "overview" ? (
          <div className="space-y-3">
            {sections.map((section, index) => (
              <div
                key={section.title}
                className="rounded-[1.55rem] border border-border/70 bg-muted/15 px-5 py-5"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
                  {index === 0
                    ? "Scenario"
                    : index === 1
                      ? "Language focus"
                      : "Goal"}
                </p>
                <p className="mt-3 text-xl font-semibold text-foreground">{section.title}</p>
                <p className="mt-3 text-base leading-8 text-muted-foreground">{section.body}</p>
              </div>
            ))}

            <div className="rounded-[1.55rem] border border-border/70 bg-background/70 px-4 py-4">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="size-4 text-primary" />
                One short read, then a quick check. No extra clicks between mini lesson cards.
              </p>
            </div>
          </div>
        ) : currentCheck ? (
          <div className="space-y-4">
            <div className="rounded-[1.7rem] border border-border/70 bg-muted/15 px-5 py-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
                Question
              </p>
              <p className="mt-3 text-xl font-semibold leading-8 text-foreground">
                {currentCheck.prompt}
              </p>
            </div>

            <div className="space-y-2">
              {currentCheck.options.map((option, optionIndex) => {
                const isSelected = answers[checkIndex] === String(optionIndex);

                return (
                  <label
                    key={`${currentCheck.prompt}-${optionIndex}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-[1.35rem] border px-4 py-4 transition ${
                      isSelected
                        ? "border-primary/45 bg-primary/8"
                        : "border-border/70 bg-card hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`check-${checkIndex}`}
                      value={String(optionIndex)}
                      checked={isSelected}
                      onChange={() =>
                        setAnswers((current) => ({
                          ...current,
                          [checkIndex]: String(optionIndex),
                        }))
                      }
                      className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    <span className="text-sm leading-7 text-foreground">{option}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={handleBack}
            disabled={pending || mode === "overview"}
          >
            Back
          </Button>
          <Button
            size="lg"
            className="rounded-full px-6"
            disabled={pending || (mode === "check" && !currentCheckAnswered)}
            onClick={handleContinue}
          >
            {pending
              ? "Saving..."
              : mode === "overview"
                ? checks.length > 0
                  ? "Start quick check"
                  : completionRequest?.buttonLabel ?? "Complete lesson"
                : checkIndex < checks.length - 1
                  ? "Continue"
                  : completionRequest?.buttonLabel ?? "Complete lesson"}
          </Button>
        </div>

        {mode === "check" ? (
          <div className="rounded-[1.55rem] border border-border/70 bg-muted/8 px-4 py-4">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle2 className="size-4 text-primary" />
              Lesson complete after this short check.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
