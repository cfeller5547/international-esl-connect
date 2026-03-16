"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Mic,
  Volume2,
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
  turnEndpoint: string;
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

function speakText(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function conversationStatusCopy(replyCount: number, replyTarget: number) {
  if (replyCount >= replyTarget) {
    return "Conversation complete. Continue when you're ready.";
  }

  if (replyCount === 0) {
    return "Answer naturally. One or two clear sentences are enough.";
  }

  if (replyCount === replyTarget - 1) {
    return "One more strong reply and then you'll move on.";
  }

  return "Keep the conversation going in your own words.";
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
  if (!conversationExperience || state.conversationTranscript.length > 0) {
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
  const [conversationPending, setConversationPending] = useState(false);
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
  const [conversationInput, setConversationInput] = useState("");
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
  const lastAiTurn =
    [...conversationTranscript].reverse().find((turn) => turn.speaker === "ai")?.text ?? "";

  const {
    isSupported: liveVoiceSupported,
    liveActive: liveVoiceActive,
    voiceState,
    startLiveConversation,
    pauseLiveConversation,
  } = useAssessmentLiveVoice({
    openingTurn: conversationExperience?.openingTurn ?? "",
    setError,
    onVoiceTurn: async ({ transcriptText, durationSeconds }) => {
      const result = await submitConversationTurn({
        text: transcriptText,
        durationSeconds,
        voiceCaptured: true,
      });

      if (!result) {
        return null;
      }

      return {
        aiReplyText: result.aiResponseText,
        continueConversation: !result.canAdvance,
      };
    },
  });

  async function submitConversationTurn(studentInput?: {
    text?: string;
    audioDataUrl?: string;
    audioMimeType?: string;
    durationSeconds?: number;
    voiceCaptured?: boolean;
  }) {
    if (!conversationExperience) {
      return null;
    }

    const text = studentInput?.text?.trim() ?? conversationInput.trim();
    if (
      diagnosticRequiresVoice &&
      !studentInput?.audioDataUrl &&
      !studentInput?.voiceCaptured
    ) {
      setError("Use the microphone to answer this part of the diagnostic.");
      return null;
    }

    if (!text && !studentInput?.audioDataUrl) {
      return null;
    }

    setConversationPending(true);
    setError(null);

    try {
      const response = await fetch(conversationExperience.turnEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assessmentAttemptId,
          transcript: conversationTranscript,
          studentInput: {
            text: text || undefined,
            audioDataUrl: studentInput?.audioDataUrl,
            audioMimeType: studentInput?.audioMimeType,
            durationSeconds: studentInput?.durationSeconds,
            voiceCaptured: studentInput?.voiceCaptured,
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        studentTranscriptText?: string;
        aiResponseText?: string;
        durationSeconds?: number;
        countsTowardProgress?: boolean;
        canAdvance?: boolean;
      };

      if (!response.ok || !payload.studentTranscriptText || !payload.aiResponseText) {
        setError(payload.error?.message ?? "We couldn't continue the conversation. Please try again.");
        setConversationPending(false);
        return null;
      }

      const studentTranscriptText = payload.studentTranscriptText.trim();
      const aiResponseText = payload.aiResponseText.trim();
      const studentTurn: AssessmentConversationTurn = {
        speaker: "student",
        text: studentTranscriptText,
        countsTowardProgress: payload.countsTowardProgress !== false,
      };
      const aiTurn: AssessmentConversationTurn = {
        speaker: "ai",
        text: aiResponseText,
      };

      setConversationTranscript((current) => [
        ...current,
        studentTurn,
        aiTurn,
      ]);
      setConversationDurationSeconds(
        (current) => current + (payload.durationSeconds ?? studentInput?.durationSeconds ?? 0)
      );
      setConversationInput("");
      return {
        aiResponseText,
        canAdvance: Boolean(payload.canAdvance),
      };
    } catch {
      setError("We couldn't continue the conversation. Please try again.");
      return null;
    } finally {
      setConversationPending(false);
    }
  }

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
                {introNote ? (
                  <div className="max-w-3xl rounded-2xl border border-secondary/20 bg-secondary/5 px-4 py-3 text-sm text-foreground">
                    {introNote}
                  </div>
                ) : null}
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
                <p className="mt-2 text-lg font-semibold text-foreground">{conversationReplyTarget}</p>
                <p className="text-sm text-muted-foreground">
                  {pluralize(conversationReplyTarget, "captured reply", "captured replies")}
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
                    : "border-border/70 bg-card/80"
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
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 lg:max-w-xs">
              <p className="text-sm font-semibold text-foreground">{currentSectionMeta.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentStep.kind === "objective"
                  ? "Select one answer before continuing."
                  : currentStep.kind === "conversation"
                    ? "Short responses are enough. Focus on clarity, not perfect grammar."
                    : currentStep.kind === "conversation_ai"
                      ? diagnosticRequiresVoice
                        ? "The AI introduces the scene first, then the mic stays live so the conversation feels natural."
                        : "Talk like you would to a real person and keep the conversation moving."
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
                <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
                  {diagnosticRequiresVoice ? "Voice required" : "Voice or text"}
                </span>
                {diagnosticRequiresVoice ? (
                  <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
                    {voiceStateCopy(voiceState)}
                  </span>
                ) : null}
                {liveVoiceActive ? (
                  <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-foreground">
                    Mic live
                  </span>
                ) : null}
                {!liveVoiceSupported && diagnosticRequiresVoice ? (
                  <span className="rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1 text-destructive">
                    Browser unsupported
                  </span>
                ) : null}
                {diagnosticRequiresVoice ? (
                  <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
                    No repeat recording taps
                  </span>
                ) : null}
                {diagnosticRequiresVoice && conversationReplyCount >= conversationReplyTarget ? (
                  <span className="rounded-full border border-secondary/20 bg-secondary/5 px-3 py-1 text-foreground">
                    Ready to continue
                  </span>
                ) : null}
              </div>

              <div className="rounded-3xl border border-border/70 bg-muted/20 p-4 sm:p-5">
                <div className="space-y-3">
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
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                              {isAi ? counterpartLabel(conversationExperience.counterpartRole) : "You"}
                            </p>
                            {isAi ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground transition hover:text-foreground"
                                onClick={() => speakText(turn.text)}
                              >
                                <Volume2 className="size-3.5" />
                                Replay
                              </button>
                            ) : null}
                          </div>
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
                    <p className="text-sm font-semibold text-foreground">Your reply</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {diagnosticRequiresVoice
                        ? `${conversationStatusCopy(conversationReplyCount, conversationReplyTarget)} Start once, then keep talking out loud as the AI responds.`
                        : conversationStatusCopy(conversationReplyCount, conversationReplyTarget)}
                    </p>
                  </div>
                  {diagnosticRequiresVoice ? (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-3">
                          {liveVoiceActive ? (
                            <Button
                              type="button"
                              size="lg"
                              variant="outline"
                              onClick={() => pauseLiveConversation()}
                              disabled={conversationPending || pending}
                            >
                              <Mic className="size-4" />
                              Pause voice
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="lg"
                              onClick={() =>
                                void startLiveConversation({
                                  speakOpeningTurn: conversationReplyCount === 0,
                                })
                              }
                              disabled={conversationPending || pending || !liveVoiceSupported}
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
                            ? "The mic stays live while the conversation moves turn by turn."
                            : liveVoiceSupported
                              ? "One tap starts the AI introduction and the live voice loop."
                              : "This browser can't run the live voice diagnostic."}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm text-foreground">
                        Typing is disabled here. This diagnostic uses voice so we can hear how the learner responds in spoken English.
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          size="lg"
                          onClick={() => void submitConversationTurn()}
                          disabled={conversationPending || pending || !conversationInput.trim()}
                        >
                          {conversationPending ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Sending
                            </>
                          ) : (
                            "Send reply"
                          )}
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {countWords(conversationInput)} words
                      </div>
                    </div>
                  )}
                  {!diagnosticRequiresVoice ? (
                    <Textarea
                      value={conversationInput}
                      onChange={(event) => {
                        setError(null);
                        setConversationInput(event.target.value);
                      }}
                      placeholder="Type your reply here. Simple English is fine."
                      className="min-h-32 resize-y rounded-3xl border-border/70 bg-background/80 px-4 py-3"
                      disabled={conversationPending || pending}
                    />
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
                        {conversationExperience.helpfulPhrases.join(" · ")}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Example</p>
                      <p className="mt-1">{conversationExperience.modelExample}</p>
                    </div>
                  </div>
                </details>
              </div>

              <div className="rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm text-foreground">
                {lastAiTurn ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 font-medium text-foreground transition hover:text-primary"
                    onClick={() => speakText(lastAiTurn)}
                  >
                    <Volume2 className="size-4" />
                    Replay the latest AI reply
                  </button>
                ) : null}
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
            disabled={pending || conversationPending}
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
                disabled={!currentStepComplete || pending || conversationPending}
                className="w-full sm:w-auto"
              >
                {nextButtonLabel}
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                disabled={!allRequiredComplete || pending || conversationPending}
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
