"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { SpeakMissionStageFrame } from "@/features/speak/speak-live-stage";
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
  const router = useRouter();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [transcript, setTranscript] = useState<SpeakTranscriptTurn[]>(initialTurns);
  const [review, setReview] = useState<SpeakSessionReview | null>(initialReview);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [phase, setPhase] = useState<"brief" | "conversation" | "review">(
    status !== "active"
      ? "review"
      : initialTurns.some((turn) => turn.speaker === "student")
        ? "conversation"
        : mission.mode === "guided"
          ? "brief"
          : "conversation"
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
          speakerRole: "student",
          channel: "scene",
          deliveryMode: interactionMode === "voice" ? "spoken" : "text_only",
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
          speakerRole: "counterpart",
          channel: "scene",
          voiceProfile: "scene_counterpart",
          deliveryMode: interactionMode === "voice" ? "spoken" : "text_only",
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
      setTranscriptOpen(false);
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
  const showMissionBrief = phase === "brief" && mission.mode === "guided";
  const showCounterpart = mission.mode === "guided";

  return (
    <div className="space-y-6">
      {showMissionBrief ? (
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
        <SpeakMissionStageFrame
          mission={mission}
          turns={transcript}
          stateLabel={pending ? "Thinking" : interactionMode === "voice" ? "Voice live" : "Text ready"}
          liveTone={pending ? "thinking" : "ready"}
          studentTurnCount={studentTurnCount}
          onBack={() => router.push("/app/speak")}
          topAction={
            <Button variant="ghost" onClick={handleFinish} disabled={pending} className="rounded-full">
              Finish
            </Button>
          }
          primaryControl={
            interactionMode === "text" ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !pending && input.trim().length >= 2) {
                      void handleSend();
                    }
                  }}
                  placeholder="Type your reply to the scene."
                  className="h-14 rounded-full border-border/70 bg-background/80 px-5 text-base"
                />
                <Button
                  onClick={handleSend}
                  disabled={pending || input.trim().length < 2}
                  className="h-14 rounded-full px-6"
                >
                  <Send className="mr-2 size-4" />
                  Send reply
                </Button>
              </div>
            ) : (
              <div className="rounded-full border border-border/70 bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
                Voice is not active in this fallback panel. Use the live voice path to continue speaking.
              </div>
            )
          }
          secondaryControls={
            <>
              <Button variant="outline" onClick={revealHelpPrompt} className="rounded-full">
                <Lightbulb className="mr-2 size-4" />
                Help me
              </Button>
              <Button variant="ghost" size="sm" onClick={speakLatestAiTurn} className="rounded-full">
                <Volume2 className="mr-2 size-4" />
                Replay latest line
              </Button>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                {showCounterpart ? counterpartLabel : "Conversation partner"}
              </Badge>
            </>
          }
          transcriptOpen={transcriptOpen}
          onTranscriptToggle={() => setTranscriptOpen((current) => !current)}
          transcriptDrawer={<SpeakTranscriptPane turns={transcript} />}
          helpPrompt={helpPrompt}
          repairNotice={null}
        />
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
            <SpeakReviewPanel review={review} sessionId={sessionId} mode={mission.mode} />
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
