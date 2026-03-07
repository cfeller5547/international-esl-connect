"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn, toTitleCase } from "@/lib/utils";

type AssessmentQuestion = {
  id: string;
  skill: "listening" | "speaking" | "reading" | "writing" | "vocabulary" | "grammar";
  prompt: string;
  options: readonly string[];
  correctValue: string;
};

type AssessmentStep =
  | {
      id: string;
      kind: "objective";
      section: "objective";
      sectionIndex: number;
      sectionTotal: number;
      question: AssessmentQuestion;
    }
  | {
      id: string;
      kind: "conversation";
      section: "conversation";
      sectionIndex: number;
      sectionTotal: number;
      prompt: string;
      promptIndex: number;
    }
  | {
      id: string;
      kind: "writing";
      section: "writing";
      sectionIndex: number;
      sectionTotal: 1;
    };

type AssessmentFormProps = {
  storageKey: string;
  assessmentAttemptId: string;
  endpoint: string;
  questions: readonly AssessmentQuestion[];
  prompts: string[];
  title: string;
  description: string;
  submitLabel: string;
  includesWritingPrompt?: boolean;
  extraPayload?: Record<string, unknown>;
  backHref?: string;
};

const emptyAssessmentState = {
  answers: {} as Record<string, string>,
  conversation: {} as Record<string, string>,
  writingSample: "",
};

const sectionMeta = {
  objective: {
    navLabel: "skills check",
    eyebrow: "Skills check",
    title: "Answer one question at a time",
    description: "Choose the best answer before moving forward.",
  },
  conversation: {
    navLabel: "conversation",
    eyebrow: "AI conversation",
    title: "Respond in your own words",
    description: "Typing works the same way if voice input is unavailable.",
  },
  writing: {
    navLabel: "writing sample",
    eyebrow: "Writing sample",
    title: "Write a short paragraph",
    description: "Use simple English and focus on clear ideas.",
  },
} as const;

function buildAssessmentSteps(
  questions: readonly AssessmentQuestion[],
  prompts: string[],
  includesWritingPrompt: boolean,
) {
  const objectiveSteps: AssessmentStep[] = questions.map((question, index) => ({
    id: question.id,
    kind: "objective",
    section: "objective",
    sectionIndex: index,
    sectionTotal: questions.length,
    question,
  }));

  const conversationSteps: AssessmentStep[] = prompts.map((prompt, index) => ({
    id: `prompt-${index}`,
    kind: "conversation",
    section: "conversation",
    sectionIndex: index,
    sectionTotal: prompts.length,
    prompt,
    promptIndex: index,
  }));

  const writingSteps: AssessmentStep[] = includesWritingPrompt
    ? [
        {
          id: "writing-sample",
          kind: "writing",
          section: "writing",
          sectionIndex: 0,
          sectionTotal: 1,
        },
      ]
    : [];

  return [...objectiveSteps, ...conversationSteps, ...writingSteps];
}

function getStoredState(storageKey: string) {
  if (typeof window === "undefined") {
    return emptyAssessmentState;
  }

  const stored = window.localStorage.getItem(storageKey);

  if (!stored) {
    return emptyAssessmentState;
  }

  try {
    const parsed = JSON.parse(stored) as {
      answers?: Record<string, string>;
      conversation?: Record<string, string>;
      writingSample?: string;
    };

    return {
      answers: parsed.answers ?? {},
      conversation: parsed.conversation ?? {},
      writingSample: parsed.writingSample ?? "",
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return emptyAssessmentState;
  }
}

function isStepComplete(
  step: AssessmentStep,
  answers: Record<string, string>,
  conversation: Record<string, string>,
  writingSample: string,
) {
  if (step.kind === "objective") {
    return Boolean(answers[step.question.id]);
  }

  if (step.kind === "conversation") {
    return Boolean(conversation[String(step.promptIndex)]?.trim());
  }

  return Boolean(writingSample.trim());
}

function getFirstIncompleteStep(
  steps: AssessmentStep[],
  answers: Record<string, string>,
  conversation: Record<string, string>,
  writingSample: string,
) {
  const firstIncompleteIndex = steps.findIndex((step) =>
    !isStepComplete(step, answers, conversation, writingSample)
  );

  return firstIncompleteIndex === -1 ? Math.max(steps.length - 1, 0) : firstIncompleteIndex;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function countWords(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).length;
}

export function AssessmentForm({
  storageKey,
  assessmentAttemptId,
  endpoint,
  questions,
  prompts,
  title,
  description,
  submitLabel,
  includesWritingPrompt = false,
  extraPayload = {},
  backHref,
}: AssessmentFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialState] = useState(() => getStoredState(storageKey));
  const [answers, setAnswers] = useState<Record<string, string>>(initialState.answers);
  const [conversation, setConversation] = useState<Record<string, string>>(initialState.conversation);
  const [writingSample, setWritingSample] = useState(initialState.writingSample);
  const [currentStepIndex, setCurrentStepIndex] = useState(() =>
    getFirstIncompleteStep(
      buildAssessmentSteps(questions, prompts, includesWritingPrompt),
      initialState.answers,
      initialState.conversation,
      initialState.writingSample,
    )
  );

  const steps = useMemo(
    () => buildAssessmentSteps(questions, prompts, includesWritingPrompt),
    [questions, prompts, includesWritingPrompt]
  );

  useEffect(() => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ answers, conversation, writingSample })
    );
  }, [answers, conversation, writingSample, storageKey]);

  const answeredQuestionCount = useMemo(
    () => questions.filter((question) => answers[question.id]).length,
    [answers, questions]
  );

  const answeredPromptCount = useMemo(
    () => prompts.filter((_, index) => conversation[String(index)]?.trim()).length,
    [conversation, prompts]
  );

  const writingCount = includesWritingPrompt && writingSample.trim() ? 1 : 0;
  const totalRequiredCount = questions.length + prompts.length + (includesWritingPrompt ? 1 : 0);
  const completedRequiredCount = answeredQuestionCount + answeredPromptCount + writingCount;
  const completionPct =
    totalRequiredCount === 0 ? 100 : Math.round((completedRequiredCount / totalRequiredCount) * 100);
  const allRequiredComplete = completedRequiredCount === totalRequiredCount;

  const currentStep = steps[currentStepIndex];
  const currentSectionKey = currentStep.section;
  const currentSectionMeta = sectionMeta[currentSectionKey];
  const isLastStep = currentStepIndex === steps.length - 1;
  const currentStepComplete = isStepComplete(currentStep, answers, conversation, writingSample);

  const sectionSummaries = [
    {
      key: "objective",
      label: "Skills check",
      description: pluralize(questions.length, "question"),
      completed: answeredQuestionCount,
      total: questions.length,
    },
    {
      key: "conversation",
      label: "Conversation",
      description: pluralize(prompts.length, "response"),
      completed: answeredPromptCount,
      total: prompts.length,
    },
    ...(includesWritingPrompt
      ? [
          {
            key: "writing",
            label: "Writing sample",
            description: "1 short paragraph",
            completed: writingCount,
            total: 1,
          },
        ]
      : []),
  ] as const;

  const currentResponseValue =
    currentStep.kind === "conversation"
      ? conversation[String(currentStep.promptIndex)] ?? ""
      : currentStep.kind === "writing"
        ? writingSample
        : "";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!allRequiredComplete) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assessmentAttemptId,
          payload: {
            objectiveAnswers: questions.map((question) => ({
              questionId: question.id,
              value: answers[question.id] ?? "",
              correctValue: question.correctValue,
              skill: question.skill,
            })),
            conversationTurns: prompts.map((prompt, index) => ({
              prompt,
              answer: conversation[String(index)] ?? "",
            })),
            writingSample: includesWritingPrompt ? writingSample : undefined,
          },
          ...extraPayload,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as
        | { error?: { message?: string }; reportId?: string; redirectTo?: string }
        | { error?: { message?: string }; reportPreviewId?: string; redirectTo?: string };

      if (!response.ok) {
        const maybeError = "error" in data ? data.error : undefined;
        setError(maybeError?.message ?? "We couldn't submit your assessment. Please try again.");
        setPending(false);
        return;
      }

      window.localStorage.removeItem(storageKey);

      if ("reportId" in data && data.reportId) {
        router.push(data.redirectTo ?? `/app/progress/reports/${data.reportId}`);
        return;
      }

      router.push(data.redirectTo ?? "/onboarding/results");
    } catch {
      setError("We couldn't submit your assessment. Please try again.");
      setPending(false);
    }
  }

  function handleBack() {
    setError(null);

    if (currentStepIndex > 0) {
      setCurrentStepIndex((current) => current - 1);
      return;
    }

    if (backHref) {
      router.push(backHref);
      return;
    }

    router.back();
  }

  function handleContinue() {
    if (!currentStepComplete || isLastStep) {
      return;
    }

    setError(null);
    setCurrentStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  const nextButtonLabel = !isLastStep
    ? steps[currentStepIndex + 1].section !== currentSectionKey
      ? `Continue to ${sectionMeta[steps[currentStepIndex + 1].section].navLabel}`
      : "Continue"
    : submitLabel;

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card className="border-border/70 bg-card/95 shadow-lg shadow-primary/5">
        <CardHeader className="space-y-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                Guided assessment
              </p>
              <div className="space-y-2">
                <CardTitle className="text-2xl sm:text-[2rem]">{title}</CardTitle>
                <CardDescription className="max-w-3xl text-sm sm:text-base">
                  {description}
                </CardDescription>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Skills check
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">{questions.length}</p>
                <p className="text-sm text-muted-foreground">
                  {pluralize(questions.length, "focused question")}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Conversation
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">{prompts.length}</p>
                <p className="text-sm text-muted-foreground">
                  {pluralize(prompts.length, "short response")}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Progress saved
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">Auto</p>
                <p className="text-sm text-muted-foreground">
                  Refreshing keeps your place on this device.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Step {currentStepIndex + 1} of {steps.length}
              </span>
              <span>{completionPct}% complete</span>
            </div>
            <Progress value={completionPct} className="h-2.5" />
          </div>
        </CardHeader>
      </Card>

      <div className={cn("grid gap-3", includesWritingPrompt ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {sectionSummaries.map((section) => {
          const isCurrent = section.key === currentSectionKey;
          const isComplete = section.completed === section.total;

          return (
            <div
              key={section.key}
              className={cn(
                "rounded-3xl border px-4 py-4",
                isCurrent
                  ? "border-primary/30 bg-card/95 shadow-md shadow-primary/10"
                  : isComplete
                    ? "border-primary/20 bg-primary/5"
                    : "border-border/70 bg-card/80",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                  {section.label}
                </p>
                <p className="text-sm font-medium text-muted-foreground">
                  {section.completed}/{section.total}
                </p>
              </div>
              <p className="mt-3 text-base font-semibold text-foreground">
                {isComplete ? "Complete" : isCurrent ? "In progress" : "Up next"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
            </div>
          );
        })}
      </div>

      <Card className="border-border/70 bg-card/95 shadow-xl shadow-slate-950/5">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                {currentSectionMeta.eyebrow} - {currentStep.sectionIndex + 1} of {currentStep.sectionTotal}
              </p>
              <div className="space-y-2">
                <CardTitle className="text-2xl leading-tight sm:text-[2rem]">
                  {currentStep.kind === "objective"
                    ? currentStep.question.prompt
                    : currentStep.kind === "conversation"
                      ? currentStep.prompt
                      : "Write 3-5 sentences about what you learned this week."}
                </CardTitle>
                <CardDescription className="max-w-2xl text-sm sm:text-base">
                  {currentStep.kind === "objective"
                    ? `${currentSectionMeta.description} This question focuses on ${toTitleCase(currentStep.question.skill)}.`
                    : currentStep.kind === "conversation"
                      ? currentSectionMeta.description
                      : `${currentSectionMeta.description} Aim for 3-5 full sentences.`}
                </CardDescription>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 lg:max-w-xs">
              <p className="text-sm font-semibold text-foreground">{currentSectionMeta.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentStep.kind === "objective"
                  ? "Select one answer before continuing."
                  : currentStep.kind === "conversation"
                    ? "Short responses are enough. Focus on clarity, not perfect grammar."
                    : "A short paragraph is enough. Clear ideas matter more than length."}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {currentStep.kind === "objective" ? (
            <fieldset className="space-y-3">
              <legend className="sr-only">{currentStep.question.prompt}</legend>
              {currentStep.question.options.map((option, optionIndex) => {
                const isSelected = answers[currentStep.question.id] === String(optionIndex);

                return (
                  <label key={`${currentStep.question.id}-${optionIndex}`} className="block cursor-pointer">
                    <input
                      type="radio"
                      name={currentStep.question.id}
                      value={String(optionIndex)}
                      checked={isSelected}
                      onChange={() => {
                        setError(null);
                        setAnswers((current) => ({
                          ...current,
                          [currentStep.question.id]: String(optionIndex),
                        }));
                      }}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "flex items-start gap-4 rounded-3xl border px-5 py-4 transition-all",
                        isSelected
                          ? "border-primary/30 bg-primary/6 shadow-sm"
                          : "border-border/70 bg-background/75 hover:border-primary/20 hover:bg-muted/20",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background",
                        )}
                      >
                        {isSelected ? <Check className="size-3" /> : null}
                      </span>
                      <span className="text-base leading-relaxed text-foreground">{option}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <div className="space-y-3">
              <Label htmlFor={currentStep.id} className="text-sm font-semibold text-foreground">
                Your response
              </Label>
              <Textarea
                id={currentStep.id}
                rows={currentStep.kind === "writing" ? 8 : 6}
                value={currentResponseValue}
                onChange={(event) => {
                  setError(null);

                  if (currentStep.kind === "conversation") {
                    setConversation((current) => ({
                      ...current,
                      [String(currentStep.promptIndex)]: event.target.value,
                    }));
                    return;
                  }

                  setWritingSample(event.target.value);
                }}
                placeholder={
                  currentStep.kind === "conversation"
                    ? "Write 1-3 sentences. Simple English is fine."
                    : "Write 3-5 complete sentences."
                }
                className="min-h-40 resize-y rounded-3xl border-border/70 bg-background/80 px-4 py-3"
              />
              <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>
                  {currentStep.kind === "conversation"
                    ? "You can type your answer here at any time."
                    : "A short paragraph is enough for the writing sample."}
                </p>
                <p>{countWords(currentResponseValue)} words</p>
              </div>
            </div>
          )}

          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" size="lg" variant="outline" onClick={handleBack} disabled={pending}>
            <ArrowLeft className="size-4" />
            Back
          </Button>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {!isLastStep ? (
              <Button
                type="button"
                size="lg"
                onClick={handleContinue}
                disabled={!currentStepComplete || pending}
                className="w-full sm:w-auto"
              >
                {nextButtonLabel}
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                disabled={!allRequiredComplete || pending}
                className="w-full sm:w-auto"
              >
                {pending ? "Submitting..." : submitLabel}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
