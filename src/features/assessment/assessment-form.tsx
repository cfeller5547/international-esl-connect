"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Mic,
} from "lucide-react";
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
import {
  type AssessmentVoiceState,
  useAssessmentLiveVoice,
} from "@/features/assessment/use-assessment-live-voice";
import { cn, toTitleCase } from "@/lib/utils";

type AssessmentQuestion = {
  id: string;
  skill: "listening" | "speaking" | "reading" | "writing" | "vocabulary" | "grammar";
  prompt: string;
  options: readonly string[];
  correctValue: string;
};

type AssessmentConversationExperience = {
  scenarioTitle: string;
  scenarioSetup: string;
  counterpartRole: string;
  introductionText: string;
  openingQuestion: string;
  openingTurn: string;
  helpfulPhrases: readonly string[];
  modelExample: string;
  responseTarget: number;
  realtimeEndpoint: string;
  requireVoice?: boolean;
};

type AssessmentConversationTurn = {
  speaker: "ai" | "student";
  text: string;
  countsTowardProgress?: boolean;
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
      id: "conversation-ai";
      kind: "conversation_ai";
      section: "conversation";
      sectionIndex: 0;
      sectionTotal: 1;
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
  initialState?: {
    answers: Record<string, string>;
    conversation: Record<string, string>;
    writingSample: string;
    conversationTranscript?: AssessmentConversationTurn[];
    conversationDurationSeconds?: number;
  };
  introNote?: string;
  conversationExperience?: AssessmentConversationExperience;
};

type StoredAssessmentState = {
  answers: Record<string, string>;
  conversation: Record<string, string>;
  writingSample: string;
  conversationTranscript: AssessmentConversationTurn[];
  conversationDurationSeconds: number;
};

const emptyAssessmentState: StoredAssessmentState = {
  answers: {},
  conversation: {},
  writingSample: "",
  conversationTranscript: [],
  conversationDurationSeconds: 0,
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
    title: "Talk naturally and keep the conversation moving",
    description: "Answer naturally and keep the conversation moving in your own words.",
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
  conversationExperience?: AssessmentConversationExperience
) {
  const objectiveSteps: AssessmentStep[] = questions.map((question, index) => ({
    id: question.id,
    kind: "objective",
    section: "objective",
    sectionIndex: index,
    sectionTotal: questions.length,
    question,
  }));

  const conversationSteps: AssessmentStep[] = conversationExperience
    ? [
        {
          id: "conversation-ai",
          kind: "conversation_ai",
          section: "conversation",
          sectionIndex: 0,
          sectionTotal: 1,
        },
      ]
    : prompts.map((prompt, index) => ({
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

function buildConversationPairs(turns: AssessmentConversationTurn[]) {
  const pairs: Array<{ prompt: string; answer: string }> = [];
  let pendingPrompt = "";

  for (const turn of turns) {
    const text = turn.text.trim();
    if (!text) {
      continue;
    }

    if (turn.speaker === "ai") {
      pendingPrompt = text;
      continue;
    }

    if (turn.countsTowardProgress !== false) {
      pairs.push({
        prompt: pendingPrompt,
        answer: text,
      });
    }
  }

  return pairs;
}

function getInitialState(
  storageKey: string,
  seededState?: AssessmentFormProps["initialState"]
): StoredAssessmentState {
  const baseState: StoredAssessmentState = {
    answers: seededState?.answers ?? emptyAssessmentState.answers,
    conversation: seededState?.conversation ?? emptyAssessmentState.conversation,
    writingSample: seededState?.writingSample ?? emptyAssessmentState.writingSample,
    conversationTranscript:
      seededState?.conversationTranscript ?? emptyAssessmentState.conversationTranscript,
    conversationDurationSeconds:
      seededState?.conversationDurationSeconds ?? emptyAssessmentState.conversationDurationSeconds,
  };

  if (typeof window === "undefined") {
    return baseState;
  }

  const stored = window.localStorage.getItem(storageKey);

  if (!stored) {
    return baseState;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<StoredAssessmentState>;

    return {
      answers: {
        ...baseState.answers,
        ...(parsed.answers ?? {}),
      },
      conversation: {
        ...baseState.conversation,
        ...(parsed.conversation ?? {}),
      },
      writingSample: parsed.writingSample ?? baseState.writingSample,
      conversationTranscript: Array.isArray(parsed.conversationTranscript)
        ? parsed.conversationTranscript
            .map((turn) => {
              const speaker: "ai" | "student" =
                turn.speaker === "student" ? "student" : "ai";

              return {
                speaker,
                text: String(turn.text ?? "").trim(),
                countsTowardProgress:
                  typeof turn.countsTowardProgress === "boolean"
                    ? turn.countsTowardProgress
                    : undefined,
              };
            })
            .filter((turn) => turn.text.length > 0)
        : baseState.conversationTranscript,
      conversationDurationSeconds:
        typeof parsed.conversationDurationSeconds === "number"
          ? parsed.conversationDurationSeconds
          : baseState.conversationDurationSeconds,
    };
  } catch {
    window.localStorage.removeItem(storageKey);
    return baseState;
  }
}

function isStepComplete(
  step: AssessmentStep,
  answers: Record<string, string>,
  conversation: Record<string, string>,
  writingSample: string,
  conversationReplyCount: number,
  conversationTarget: number
) {
  if (step.kind === "objective") {
    return Boolean(answers[step.question.id]);
  }

  if (step.kind === "conversation") {
    return Boolean(conversation[String(step.promptIndex)]?.trim());
  }

  if (step.kind === "conversation_ai") {
    return conversationReplyCount >= conversationTarget;
  }

  return Boolean(writingSample.trim());
}

function getFirstIncompleteStep(
  steps: AssessmentStep[],
  answers: Record<string, string>,
  conversation: Record<string, string>,
  writingSample: string,
  conversationReplyCount: number,
  conversationTarget: number
) {
  const firstIncompleteIndex = steps.findIndex((step) =>
    !isStepComplete(
      step,
      answers,
      conversation,
      writingSample,
      conversationReplyCount,
      conversationTarget
    )
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

function conversationActionCopy({
  replyCount,
  replyTarget,
  liveVoiceActive,
  liveVoiceSupported,
}: {
  replyCount: number;
  replyTarget: number;
  liveVoiceActive: boolean;
  liveVoiceSupported: boolean;
}) {
  if (replyCount >= replyTarget) {
    return "You have enough responses. Continue when you are ready.";
  }

  if (liveVoiceActive) {
    return "Keep answering out loud. The AI will keep the conversation moving.";
  }

  if (!liveVoiceSupported) {
    return "This browser cannot run the live interview.";
  }

  return "Start once, then keep talking naturally while the AI responds.";
}

function voiceStateCopy(state: AssessmentVoiceState) {
  switch (state) {
    case "starting":
      return "Starting live voice";
    case "listening":
      return "Listening";
    case "thinking":
      return "Thinking";
    case "speaking":
      return "Speaking";
    case "error":
      return "Voice issue";
    default:
      return "Ready";
  }
}

function counterpartLabel(counterpartRole: string) {
  switch (counterpartRole) {
    case "placement_coach":
      return "Placement coach";
    default:
      return "Conversation partner";
  }
}

function withOpeningTurn(
  state: StoredAssessmentState,
  conversationExperience?: AssessmentConversationExperience
): StoredAssessmentState {
  if (
    !conversationExperience ||
    conversationExperience.requireVoice ||
    state.conversationTranscript.length > 0
  ) {
    return state;
  }

  const openingTurn: AssessmentConversationTurn = {
    speaker: "ai",
    text: conversationExperience.openingTurn,
  };

  return {
    ...state,
    conversationTranscript: [openingTurn],
  };
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
  initialState: seededInitialState,
  introNote,
  conversationExperience,
}: AssessmentFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRestoredClientState, setHasRestoredClientState] = useState(false);
  const seededState = withOpeningTurn(
    {
      answers: seededInitialState?.answers ?? emptyAssessmentState.answers,
      conversation: seededInitialState?.conversation ?? emptyAssessmentState.conversation,
      writingSample: seededInitialState?.writingSample ?? emptyAssessmentState.writingSample,
      conversationTranscript:
        seededInitialState?.conversationTranscript ?? emptyAssessmentState.conversationTranscript,
      conversationDurationSeconds:
        seededInitialState?.conversationDurationSeconds ??
        emptyAssessmentState.conversationDurationSeconds,
    },
    conversationExperience
  );
  const seededConversationReplyCount = conversationExperience
    ? buildConversationPairs(seededState.conversationTranscript).slice(
        0,
        conversationExperience.responseTarget
      ).length
    : prompts.filter((_, index) => seededState.conversation[String(index)]?.trim()).length;
  const [answers, setAnswers] = useState<Record<string, string>>(seededState.answers);
  const [conversation, setConversation] = useState<Record<string, string>>(seededState.conversation);
  const [writingSample, setWritingSample] = useState(seededState.writingSample);
  const [conversationTranscript, setConversationTranscript] = useState<AssessmentConversationTurn[]>(
    seededState.conversationTranscript
  );
  const [conversationDurationSeconds, setConversationDurationSeconds] = useState(
    seededState.conversationDurationSeconds
  );

  const conversationReplyTarget = conversationExperience?.responseTarget ?? prompts.length;
  const diagnosticRequiresVoice = conversationExperience?.requireVoice ?? false;
  const conversationPairs = useMemo(
    () =>
      conversationExperience
        ? buildConversationPairs(conversationTranscript).slice(0, conversationReplyTarget)
        : [],
    [conversationExperience, conversationReplyTarget, conversationTranscript]
  );
  const conversationReplyCount = conversationExperience
    ? conversationPairs.length
    : prompts.filter((_, index) => conversation[String(index)]?.trim()).length;

  const steps = useMemo(
    () => buildAssessmentSteps(questions, prompts, includesWritingPrompt, conversationExperience),
    [conversationExperience, includesWritingPrompt, prompts, questions]
  );

  const [currentStepIndex, setCurrentStepIndex] = useState(() =>
    getFirstIncompleteStep(
      steps,
      seededState.answers,
      seededState.conversation,
      seededState.writingSample,
      seededConversationReplyCount,
      conversationReplyTarget
    )
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const restoredState = withOpeningTurn(
      getInitialState(storageKey, seededInitialState),
      conversationExperience
    );
    const restoredReplyCount = conversationExperience
      ? buildConversationPairs(restoredState.conversationTranscript).slice(
          0,
          conversationReplyTarget
        ).length
      : prompts.filter((_, index) => restoredState.conversation[String(index)]?.trim()).length;

    setAnswers(restoredState.answers);
    setConversation(restoredState.conversation);
    setWritingSample(restoredState.writingSample);
    setConversationTranscript(restoredState.conversationTranscript);
    setConversationDurationSeconds(restoredState.conversationDurationSeconds);
    setCurrentStepIndex(
      getFirstIncompleteStep(
        steps,
        restoredState.answers,
        restoredState.conversation,
        restoredState.writingSample,
        restoredReplyCount,
        conversationReplyTarget
      )
    );
    setHasRestoredClientState(true);
  }, [
    conversationExperience,
    conversationReplyTarget,
    prompts,
    seededInitialState,
    steps,
    storageKey,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hasRestoredClientState) {
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        answers,
        conversation,
        writingSample,
        conversationTranscript,
        conversationDurationSeconds,
      } satisfies StoredAssessmentState)
    );
  }, [
    answers,
    conversation,
    conversationDurationSeconds,
    conversationTranscript,
    hasRestoredClientState,
    storageKey,
    writingSample,
  ]);

  const answeredQuestionCount = useMemo(
    () => questions.filter((question) => answers[question.id]).length,
    [answers, questions]
  );

  const writingCount = includesWritingPrompt && writingSample.trim() ? 1 : 0;
  const totalRequiredCount =
    questions.length + conversationReplyTarget + (includesWritingPrompt ? 1 : 0);
  const completedRequiredCount = answeredQuestionCount + conversationReplyCount + writingCount;
  const completionPct =
    totalRequiredCount === 0 ? 100 : Math.round((completedRequiredCount / totalRequiredCount) * 100);
  const allRequiredComplete = completedRequiredCount === totalRequiredCount;

  const currentStep = steps[currentStepIndex];
  const currentSectionKey = currentStep.section;
  const currentSectionMeta = sectionMeta[currentSectionKey];
  const isLastStep = currentStepIndex === steps.length - 1;
  const currentStepComplete = isStepComplete(
    currentStep,
    answers,
    conversation,
    writingSample,
    conversationReplyCount,
    conversationReplyTarget
  );

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
      label: conversationExperience ? "AI conversation" : "Conversation",
      description: pluralize(conversationReplyTarget, "response"),
      completed: conversationReplyCount,
      total: conversationReplyTarget,
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
  const nextButtonLabel = !isLastStep
    ? steps[currentStepIndex + 1].section !== currentSectionKey
      ? `Continue to ${sectionMeta[steps[currentStepIndex + 1].section].navLabel}`
      : "Continue"
    : submitLabel;
  const {
    isSupported: liveVoiceSupported,
    liveActive: liveVoiceActive,
    voiceState,
    startLiveConversation,
    pauseLiveConversation,
  } = useAssessmentLiveVoice({
    assessmentAttemptId,
    realtimeEndpoint: conversationExperience?.realtimeEndpoint ?? "",
    openingTurn: conversationExperience?.openingTurn ?? "",
    transcript: conversationTranscript,
    setTranscript: setConversationTranscript,
    setConversationDurationSeconds,
    setError,
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!allRequiredComplete) {
      return;
    }

    if (liveVoiceActive) {
      pauseLiveConversation();
    }

    setPending(true);
    setError(null);

    const conversationTurnsPayload = conversationExperience
      ? conversationPairs.map((turn) => ({
          prompt: turn.prompt,
          answer: turn.answer,
        }))
      : prompts.map((prompt, index) => ({
          prompt,
          answer: conversation[String(index)] ?? "",
        }));

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
            conversationTurns: conversationTurnsPayload,
            writingSample: includesWritingPrompt ? writingSample : undefined,
            durationSeconds: conversationDurationSeconds || undefined,
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

    if (liveVoiceActive) {
      pauseLiveConversation();
    }

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
    if (liveVoiceActive) {
      pauseLiveConversation();
    }
    setCurrentStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card className="border-border/70 bg-card/95 shadow-lg shadow-primary/5">
        <CardHeader className="space-y-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
              Guided assessment
            </p>
            <div className="space-y-2">
              <CardTitle className="text-2xl sm:text-[2rem]">{title}</CardTitle>
              <CardDescription className="max-w-3xl text-sm sm:text-base">
                {description}
              </CardDescription>
              {introNote ? (
                <div className="max-w-3xl rounded-2xl border border-secondary/20 bg-secondary/5 px-4 py-3 text-sm text-foreground">
                  {introNote}
                </div>
              ) : null}
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
            <p className="text-sm text-muted-foreground">
              Progress saves automatically on this device.
            </p>
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
                    : "border-border/70 bg-card/80"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                    {section.label}
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {isComplete ? "Complete" : isCurrent ? "In progress" : "Up next"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">
                    {section.completed}/{section.total}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Card className="border-border/70 bg-card/95 shadow-xl shadow-slate-950/5">
        <CardHeader className="space-y-3">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
              {currentStep.kind === "conversation_ai"
                ? currentSectionMeta.eyebrow
                : `${currentSectionMeta.eyebrow} - ${currentStep.sectionIndex + 1} of ${currentStep.sectionTotal}`}
            </p>
            <div className="space-y-2">
              <CardTitle className="text-2xl leading-tight sm:text-[2rem]">
                {currentStep.kind === "objective"
                  ? currentStep.question.prompt
                  : currentStep.kind === "conversation"
                    ? currentStep.prompt
                    : currentStep.kind === "conversation_ai"
                      ? conversationExperience?.scenarioTitle
                      : "Write 3-5 sentences about what you learned this week."}
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                {currentStep.kind === "objective"
                  ? `${currentSectionMeta.description} This question focuses on ${toTitleCase(currentStep.question.skill)}.`
                  : currentStep.kind === "conversation"
                    ? currentSectionMeta.description
                    : currentStep.kind === "conversation_ai"
                      ? conversationExperience?.scenarioSetup
                      : `${currentSectionMeta.description} Aim for 3-5 full sentences.`}
              </CardDescription>
              {currentStep.kind === "conversation_ai" && diagnosticRequiresVoice ? (
                <p className="text-sm text-muted-foreground">
                  One tap starts the live interview. After that, keep talking naturally while the AI responds.
                </p>
              ) : currentStep.kind === "writing" ? (
                <p className="text-sm text-muted-foreground">
                  Keep it concise. Clear ideas matter more than length.
                </p>
              ) : null}
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
                          : "border-border/70 bg-background/75 hover:border-primary/20 hover:bg-muted/20"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background"
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
          ) : currentStep.kind === "conversation_ai" && conversationExperience ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
                  {counterpartLabel(conversationExperience.counterpartRole)}
                </span>
                <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
                  {conversationReplyCount}/{conversationReplyTarget} captured
                </span>
                {diagnosticRequiresVoice ? (
                  <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
                    Live voice
                  </span>
                ) : null}
                {diagnosticRequiresVoice ? (
                  <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
                    {voiceStateCopy(voiceState)}
                  </span>
                ) : null}
                {!liveVoiceSupported && diagnosticRequiresVoice ? (
                  <span className="rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1 text-destructive">
                    Browser unsupported
                  </span>
                ) : null}
              </div>

              <div className="rounded-3xl border border-border/70 bg-muted/20 p-4 sm:p-5">
                <div className="space-y-3">
                  {conversationTranscript.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border/70 bg-background/85 px-4 py-4 text-sm text-muted-foreground">
                      Maya will greet you first once the live interview starts.
                    </div>
                  ) : null}
                  {conversationTranscript.map((turn, index) => {
                    const isAi = turn.speaker === "ai";

                    return (
                      <div
                        key={`${turn.speaker}-${index}-${turn.text.slice(0, 24)}`}
                        className={cn("flex", isAi ? "justify-start" : "justify-end")}
                      >
                        <div
                          className={cn(
                            "max-w-2xl rounded-3xl border px-4 py-3 shadow-sm",
                            isAi
                              ? "border-border/80 bg-background text-foreground"
                              : "border-primary/20 bg-primary/8 text-foreground"
                          )}
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                            {isAi ? counterpartLabel(conversationExperience.counterpartRole) : "You"}
                          </p>
                          <p className="mt-3 text-base leading-relaxed text-foreground">{turn.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Your turn</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {conversationActionCopy({
                        replyCount: conversationReplyCount,
                        replyTarget: conversationReplyTarget,
                        liveVoiceActive,
                        liveVoiceSupported,
                      })}
                    </p>
                  </div>
                  {diagnosticRequiresVoice ? (
                    <div className="space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-3">
                          {liveVoiceActive ? (
                            <Button
                              type="button"
                              size="lg"
                              variant="outline"
                              onClick={() => pauseLiveConversation()}
                              disabled={pending}
                            >
                              <Mic className="size-4" />
                              Pause voice
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="lg"
                              onClick={() => void startLiveConversation()}
                              disabled={pending || !liveVoiceSupported}
                            >
                              {voiceState === "starting" ? (
                                <>
                                  <Loader2 className="size-4 animate-spin" />
                                  Starting live voice
                                </>
                              ) : (
                                <>
                                  <Mic className="size-4" />
                                  {conversationReplyCount === 0
                                    ? "Start live conversation"
                                    : "Resume live conversation"}
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {liveVoiceActive
                            ? "The mic stays live until you pause."
                            : liveVoiceSupported
                              ? "Voice only for this part of the diagnostic."
                              : "This browser can't run the live voice diagnostic."}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
                <details className="group">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                    Need help?
                  </summary>
                  <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                    <div>
                      <p className="font-semibold text-foreground">Helpful phrases</p>
                      <p className="mt-1">
                        {conversationExperience.helpfulPhrases.join(" | ")}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Example</p>
                      <p className="mt-1">{conversationExperience.modelExample}</p>
                    </div>
                  </div>
                </details>
              </div>
            </div>
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
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={handleBack}
            disabled={pending}
          >
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
