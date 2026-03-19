"use client";

import { useMemo, useState } from "react";
import { Lightbulb, Send, Volume2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  SpeakCompletionCard,
  SpeakReviewPanel,
  SpeakTranscriptPane,
} from "@/features/speak/speak-session-ui";
import { trackClientEvent } from "@/lib/client-analytics";
import {
  buildSpeakHelpPrompt,
  getSpeakCounterpartLabel,
  normalizeSpeakTurnSignals,
  type SpeakMissionDetails,
  type SpeakSessionReview,
  type SpeakTranscriptTurn,
} from "@/lib/speak";

type SpeakSessionPanelProps = {
  sessionId: string;
  mission: SpeakMissionDetails;
  interactionMode: "text" | "voice";
  status: "active" | "completed" | "abandoned";
  initialTurns: SpeakTranscriptTurn[];
  initialReview: SpeakSessionReview | null;
};

export function SpeakSessionPanel({
  sessionId,
  mission,
  interactionMode,
  status,
  initialTurns,
  initialReview,
}: SpeakSessionPanelProps) {
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [transcript, setTranscript] = useState<SpeakTranscriptTurn[]>(initialTurns);
  const [review, setReview] = useState<SpeakSessionReview | null>(initialReview);
  const [phase, setPhase] = useState<"brief" | "conversation" | "review">(
    status !== "active"
      ? "review"
      : initialTurns.some((turn) => turn.speaker === "student")
        ? "conversation"
        : "brief"
  );
  const [helpPrompt, setHelpPrompt] = useState<string | null>(null);

  const aiTurns = useMemo(
    () => transcript.filter((turn) => turn.speaker === "ai"),
    [transcript]
  );
  const studentTurnCount = useMemo(
    () => transcript.filter((turn) => turn.speaker === "student").length,
    [transcript]
  );

  async function handleSend() {
    setPending(true);
    setHelpPrompt(null);

    try {
      const response = await fetch("/api/v1/speak/session/turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          studentInput: {
            text: input,
          },
        }),
      });
      const payload = (await response.json()) as {
        aiResponseText: string;
        microCoaching?: string;
        coachLabel?: string;
        turnSignals?: {
          fluencyIssue?: boolean;
          grammarIssue?: boolean;
          vocabOpportunity?: boolean;
        };
        studentTranscriptText?: string | null;
      };

      const nextStudentTurnIndex = transcript.length + 1;
      setTranscript((current) => [
        ...current,
        {
          turnIndex: nextStudentTurnIndex,
          speaker: "student",
          text: payload.studentTranscriptText?.trim() || input,
          coaching: payload.microCoaching
            ? {
                label: payload.coachLabel?.trim() || "Keep this move",
                note: payload.microCoaching,
                signals: normalizeSpeakTurnSignals(payload.turnSignals),
              }
            : null,
        },
        {
          turnIndex: nextStudentTurnIndex + 1,
          speaker: "ai",
          text: payload.aiResponseText,
          coaching: null,
        },
      ]);
      setInput("");
    } finally {
      setPending(false);
    }
  }

  async function handleFinish() {
    setPending(true);
    setHelpPrompt(null);

    try {
      await fetch("/api/v1/speak/session/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
        }),
      });

      const reviewResponse = await fetch(`/api/v1/speak/session/${sessionId}/transcript`);
      setReview((await reviewResponse.json()) as SpeakSessionReview);
      setPhase("review");
    } finally {
      setPending(false);
    }
  }

  function revealHelpPrompt() {
    const prompt = buildSpeakHelpPrompt({
      mission,
      latestAiTurn: aiTurns.at(-1)?.text ?? null,
      studentTurnCount,
    });

    setHelpPrompt(prompt);
    trackClientEvent({
      eventName: "speak_help_requested",
      route: `/app/speak/session/${sessionId}`,
      properties: {
        input_mode: interactionMode,
      },
    });
  }

  function speakLatestAiTurn() {
    const latestAiTurn = aiTurns.at(-1);
    if (!latestAiTurn || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(latestAiTurn.text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  const counterpartLabel = getSpeakCounterpartLabel(mission.counterpartRole);

  return (
    <div className="space-y-6">
      {phase === "brief" ? (
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs uppercase">
                Mission brief
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                {counterpartLabel}
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                {interactionMode === "voice" ? "Voice" : "Text"}
              </Badge>
            </div>
            <div className="space-y-3">
              <CardTitle className="text-3xl leading-tight">{mission.scenarioTitle}</CardTitle>
              <p className="max-w-3xl text-base text-muted-foreground">{mission.scenarioSetup}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Speaking goal
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {mission.canDoStatement ?? mission.performanceTask}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Why now
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {mission.recommendationReason ?? "Stay close to your current learning context."}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Target phrases
              </p>
              <div className="flex flex-wrap gap-2">
                {mission.targetPhrases.slice(0, 3).map((phrase) => (
                  <Badge key={phrase} variant="outline" className="rounded-full px-3 py-1">
                    {phrase}
                  </Badge>
                ))}
              </div>
            </div>

            {mission.openingPrompt ? (
              <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Opening line:{" "}
                <span className="font-medium text-foreground">{mission.openingPrompt}</span>
              </div>
            ) : null}

            <Button size="lg" onClick={() => setPhase("conversation")}>
              Begin conversation
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === "conversation" ? (
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs uppercase">
                  Conversation
                </Badge>
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                  {counterpartLabel}
                </Badge>
              </div>
              <div>
                <CardTitle className="text-2xl">{mission.scenarioTitle}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mission.canDoStatement ?? mission.performanceTask}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={speakLatestAiTurn}>
              <Volume2 className="size-4" />
              Play AI
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <SpeakTranscriptPane turns={transcript} />

            {interactionMode === "text" ? (
              <>
                <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto_auto]">
                  <Button variant="outline" onClick={revealHelpPrompt}>
                    <Lightbulb className="size-4" />
                    Help me
                  </Button>
                  <Input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Write your next answer."
                  />
                  <Button onClick={handleSend} disabled={pending || input.trim().length < 2}>
                    <Send className="size-4" />
                    Send
                  </Button>
                  <Button variant="secondary" onClick={handleFinish} disabled={pending}>
                    Finish session
                  </Button>
                </div>
                {helpPrompt ? (
                  <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    {helpPrompt}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                This transcript stays available after live voice sessions finish so you can review what you said and save useful phrases.
              </div>
            )}

            <div className="rounded-[1.5rem] border border-border/70 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
              Finish the session to unlock a cleaner coach summary, key moments, and reusable phrases.
            </div>
          </CardContent>
        </Card>
      ) : null}

      {phase === "review" ? (
        review ? (
          <>
            <SpeakCompletionCard
              mission={mission}
              counterpartLabel={counterpartLabel}
              review={review}
              studentTurnCount={studentTurnCount}
            />
            <SpeakReviewPanel review={review} sessionId={sessionId} />
          </>
        ) : (
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardContent className="px-6 py-5 text-sm text-muted-foreground">
              Review is loading.
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  );
}
