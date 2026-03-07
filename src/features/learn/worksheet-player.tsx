"use client";

import { useState } from "react";
import { PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  LearnActivityTransition,
  useLearnActivityCompletion,
} from "@/features/learn/learn-activity-transition";

type WorksheetQuestion = {
  id: string;
  prompt: string;
  answer: string;
};

type WorksheetPlayerProps = {
  worksheetId: string;
  unitTitle: string;
  questions: WorksheetQuestion[];
  completionRequest?: {
    endpoint: string;
    body: Record<string, unknown>;
    buttonLabel?: string;
    fallbackHref?: string;
  };
};

export function WorksheetPlayer({
  worksheetId,
  unitTitle,
  questions,
  completionRequest,
}: WorksheetPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const { pending, error, completionState, complete } = useLearnActivityCompletion({
    endpoint: completionRequest?.endpoint ?? "/api/v1/learn/activity/complete",
    fallbackHref: completionRequest?.fallbackHref ?? "/app/learn",
    activityType: "practice",
    unitTitle,
  });

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] ?? "" : "";
  const progressValue = Math.round(((currentIndex + 1) / Math.max(questions.length, 1)) * 100);

  const score = questions.length
    ? Math.round(
        (questions.filter((question) => {
          if (question.answer === "free_response") {
            return (answers[question.id] ?? "").trim().length >= 12;
          }
          return (
            (answers[question.id] ?? "").trim().toLowerCase() ===
            question.answer.trim().toLowerCase()
          );
        }).length /
          questions.length) *
          100
      )
    : 100;

  async function finishPractice() {
    await complete({
      score,
      ...(completionRequest?.body ?? {
        activityType: "worksheet",
        activityId: worksheetId,
        metadata: { unitTitle },
      }),
    });
  }

  async function handleContinue() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((current) => current + 1);
      return;
    }

    await finishPractice();
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
              Guided practice
            </p>
            <CardTitle className="mt-2 text-2xl">Work through one prompt at a time</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Question {Math.min(currentIndex + 1, questions.length)} of {Math.max(questions.length, 1)}
          </p>
        </div>
        <Progress value={progressValue} className="h-2.5" />
      </CardHeader>
      <CardContent className="space-y-5">
        {currentQuestion ? (
          <div className="space-y-4">
            <div className="rounded-[1.7rem] border border-border/70 bg-muted/15 px-5 py-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
                Practice prompt
              </p>
              <p className="mt-3 text-xl font-semibold leading-8 text-foreground">
                {currentQuestion.prompt}
              </p>
            </div>

            {currentQuestion.answer === "free_response" ? (
              <Textarea
                rows={6}
                value={currentAnswer}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [currentQuestion.id]: event.target.value,
                  }))
                }
                placeholder="Write a full response in your own words."
              />
            ) : (
              <Input
                value={currentAnswer}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [currentQuestion.id]: event.target.value,
                  }))
                }
                placeholder="Type your answer"
              />
            )}

            <div className="rounded-[1.6rem] border border-border/70 bg-background/70 px-4 py-4">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <PenLine className="size-4 text-primary" />
                Keep the response short and clear. You can revise before you continue.
              </p>
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
            disabled={pending || currentAnswer.trim().length === 0}
            onClick={handleContinue}
          >
            {pending
              ? "Saving..."
              : currentIndex < questions.length - 1
                ? "Continue"
                : completionRequest?.buttonLabel ?? "Complete practice"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
