"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LEARN_ACTIVITY_META, type LearnActivityType } from "@/features/learn/learn-flow";

type CompletionResponse = {
  nextActionHref?: string;
  unitCompleted?: boolean;
  nextAction?: {
    href?: string;
    label?: string;
    title?: string;
    description?: string;
    unitTitle?: string | null;
    activityType?: LearnActivityType | null;
    stepIndex?: number | null;
    totalSteps?: number | null;
  };
};

type CompletionState = {
  title: string;
  description: string;
  nextHref: string;
  nextLabel: string;
  nextTitle: string;
  nextDescription: string;
  nextStepLabel: string | null;
};

function buildCompletionState({
  activityType,
  unitTitle,
  fallbackHref,
  response,
}: {
  activityType: LearnActivityType;
  unitTitle: string;
  fallbackHref: string;
  response: CompletionResponse;
}): CompletionState {
  const meta = LEARN_ACTIVITY_META[activityType];
  const nextHref = response.nextAction?.href ?? response.nextActionHref ?? fallbackHref;
  const nextTitle = response.nextAction?.title ?? "Return to Learn";
  const nextDescription =
    response.nextAction?.description ??
    "Keep moving through your curriculum with the next required step.";
  const nextLabel =
    response.nextAction?.label ??
    (response.unitCompleted ? "Start next step" : "Continue");

  return {
    title: response.unitCompleted ? `${unitTitle} complete` : `${meta.completionLabel} complete`,
    description: response.unitCompleted
      ? "You finished every required step in this unit. The next milestone is ready."
      : `Your ${meta.learnerLabel} is saved. Keep the momentum going while the context is still fresh.`,
    nextHref,
    nextLabel,
    nextTitle,
    nextDescription,
    nextStepLabel:
      response.nextAction?.stepIndex && response.nextAction?.totalSteps
        ? `Step ${response.nextAction.stepIndex} of ${response.nextAction.totalSteps}`
        : null,
  };
}

export function LearnActivityTransition({
  state,
}: {
  state: CompletionState;
}) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.push(state.nextHref);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [router, state.nextHref]);

  return (
    <Card className="surface-glow border-border/70 bg-card/95">
      <CardContent className="flex min-h-[460px] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex max-w-xl flex-col items-center space-y-6">
          <div className="rounded-full border border-primary/25 bg-primary/10 p-4 text-primary">
            <CheckCircle2 className="size-10" />
          </div>
          <div className="space-y-3">
            <Badge
              variant="outline"
              className="rounded-full border-primary/30 bg-primary/8 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-primary"
            >
              Step saved
            </Badge>
            <CardTitle className="text-3xl tracking-tight text-foreground">
              {state.title}
            </CardTitle>
            <p className="text-base text-muted-foreground">{state.description}</p>
          </div>

          <div className="w-full rounded-[1.75rem] border border-border/70 bg-muted/15 px-5 py-5 text-left">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  Up next
                </p>
                <p className="text-lg font-semibold text-foreground">{state.nextTitle}</p>
                {state.nextStepLabel ? (
                  <p className="text-sm font-medium text-foreground">{state.nextStepLabel}</p>
                ) : null}
                <p className="text-sm text-muted-foreground">{state.nextDescription}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="min-w-[220px] rounded-full">
              <Link href={state.nextHref}>
                {state.nextLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Continuing automatically if you do nothing.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function useLearnActivityCompletion({
  endpoint,
  fallbackHref,
  activityType,
  unitTitle,
}: {
  endpoint: string;
  fallbackHref: string;
  activityType: LearnActivityType;
  unitTitle: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionState, setCompletionState] = useState<CompletionState | null>(null);

  async function complete(requestBody: Record<string, unknown>) {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const payload = (await response.json().catch(() => ({}))) as CompletionResponse & {
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Unable to save this activity right now.");
      }

      setCompletionState(
        buildCompletionState({
          activityType,
          unitTitle,
          fallbackHref,
          response: payload,
        })
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to save this activity right now."
      );
    } finally {
      setPending(false);
    }
  }

  return {
    pending,
    error,
    completionState,
    complete,
  };
}
