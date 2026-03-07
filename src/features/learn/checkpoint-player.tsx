"use client";

import { useState } from "react";
import { Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  LearnActivityTransition,
  useLearnActivityCompletion,
} from "@/features/learn/learn-activity-transition";

type CheckpointPlayerProps = {
  endpoint: string;
  unitSlug: string;
  unitTitle: string;
  title: string;
  description: string;
  questions: Array<{
    prompt: string;
    options: string[];
    correctIndex: number;
  }>;
  fallbackHref?: string;
};

export function CheckpointPlayer({
  endpoint,
  unitSlug,
  unitTitle,
  title,
  description,
  questions,
  fallbackHref = "/app/learn",
}: CheckpointPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const { pending, error, completionState, complete } = useLearnActivityCompletion({
    endpoint,
    fallbackHref,
    activityType: "checkpoint",
    unitTitle,
  });

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentIndex] : undefined;
  const progressValue = Math.round(((currentIndex + 1) / Math.max(questions.length, 1)) * 100);

  const score = questions.length
    ? Math.round(
        (questions.filter((question, index) => answers[index] === String(question.correctIndex)).length /
          questions.length) *
          100
      )
    : 100;

  async function finishCheckpoint() {
    await complete({
      unitSlug,
      activityType: "checkpoint",
      score,
      responsePayload: {
        answers,
      },
    });
  }

  async function handleContinue() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((current) => current + 1);
      return;
    }

    await finishCheckpoint();
  }

  if (completionState) {
    return <LearnActivityTransition state={completionState} />;
  }

  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
              Final check
            </p>
            <CardTitle className="mt-2 text-2xl">{title}</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Question {Math.min(currentIndex + 1, questions.length)} of {Math.max(questions.length, 1)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Progress value={progressValue} className="h-2.5" />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[1.6rem] border border-border/70 bg-background/70 px-4 py-4">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <Target className="size-4 text-primary" />
            Complete this final check to finish the unit and unlock what comes next.
          </p>
        </div>

        {currentQuestion ? (
          <div className="space-y-4">
            <div className="rounded-[1.7rem] border border-border/70 bg-muted/15 px-5 py-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
                Checkpoint prompt
              </p>
              <p className="mt-3 text-xl font-semibold leading-8 text-foreground">
                {currentQuestion.prompt}
              </p>
            </div>

            <div className="space-y-2">
              {currentQuestion.options.map((option, optionIndex) => {
                const isSelected = currentAnswer === String(optionIndex);

                return (
                  <label
                    key={`${currentQuestion.prompt}-${optionIndex}`}
                    className={`flex cursor-pointer items-start gap-3 rounded-[1.35rem] border px-4 py-4 transition ${
                      isSelected
                        ? "border-primary/45 bg-primary/8"
                        : "border-border/70 bg-card hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`checkpoint-${currentIndex}`}
                      value={String(optionIndex)}
                      checked={isSelected}
                      onChange={() =>
                        setAnswers((current) => ({
                          ...current,
                          [currentIndex]: String(optionIndex),
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
            onClick={() => setCurrentIndex((current) => Math.max(current - 1, 0))}
            disabled={pending || currentIndex === 0}
          >
            Back
          </Button>
          <Button
            size="lg"
            className="rounded-full px-6"
            disabled={pending || currentAnswer === undefined}
            onClick={handleContinue}
          >
            {pending
              ? "Saving..."
              : currentIndex < questions.length - 1
                ? "Continue"
                : "Complete checkpoint"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
