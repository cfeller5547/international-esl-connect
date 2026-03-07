"use client";

import { useState } from "react";
import { Mic, PenSquare, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  LearnActivityTransition,
  useLearnActivityCompletion,
} from "@/features/learn/learn-activity-transition";

type StructuredResponseActivityProps = {
  endpoint: string;
  unitSlug: string;
  unitTitle: string;
  activityType: "speaking" | "writing";
  title: string;
  description: string;
  prompts: string[];
  criteria: string[];
  fallbackHref?: string;
};

export function StructuredResponseActivity({
  endpoint,
  unitSlug,
  unitTitle,
  activityType,
  title,
  description,
  prompts,
  criteria,
  fallbackHref = "/app/learn",
}: StructuredResponseActivityProps) {
  const [answer, setAnswer] = useState("");
  const { pending, error, completionState, complete } = useLearnActivityCompletion({
    endpoint,
    fallbackHref,
    activityType,
    unitTitle,
  });

  const score = Math.min(
    100,
    Math.max(45, Math.round(answer.trim().split(/\s+/).filter(Boolean).length * 4))
  );

  async function handleSubmit() {
    await complete({
      unitSlug,
      activityType,
      score,
      responsePayload: {
        answer,
      },
    });
  }

  if (completionState) {
    return <LearnActivityTransition state={completionState} />;
  }

  const isSpeaking = activityType === "speaking";

  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
            {isSpeaking ? "Guided rehearsal" : "Writing brief"}
          </p>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          {prompts.map((prompt, index) => (
            <div
              key={`${prompt}-${index}`}
              className="rounded-[1.65rem] border border-border/70 bg-muted/15 px-5 py-5"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
                {isSpeaking ? `Prompt ${index + 1}` : "Writing task"}
              </p>
              <p className="mt-3 text-base leading-8 text-foreground">{prompt}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[1.65rem] border border-border/70 bg-background/70 px-5 py-5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            {isSpeaking ? (
              <>
                <Mic className="size-4 text-primary" />
                Say it once aloud, then save your best version
              </>
            ) : (
              <>
                <PenSquare className="size-4 text-primary" />
                What a strong response should show
              </>
            )}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {criteria.map((criterion) => (
              <li key={criterion} className="leading-7">
                - {criterion}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <Textarea
            rows={isSpeaking ? 8 : 10}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder={
              isSpeaking
                ? "Type the response you would say aloud."
                : "Write your full response here."
            }
          />

          <div className="rounded-[1.6rem] border border-border/70 bg-muted/8 px-4 py-4">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="size-4 text-primary" />
              {isSpeaking
                ? "Aim for clear, natural, connected sentences."
                : "Aim for a clear beginning, supporting detail, and a clean finish."}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {answer.trim() ? answer.trim().split(/\s+/).filter(Boolean).length : 0} words
            </p>
          </div>
        </div>

        {error ? (
          <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button
            size="lg"
            className="rounded-full px-6"
            onClick={handleSubmit}
            disabled={pending || answer.trim().length < 20}
          >
            {pending
              ? "Saving..."
              : isSpeaking
                ? "Save speaking response"
                : "Save writing response"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
