"use client";

import { useEffect, useMemo, useState } from "react";
import { Mic, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useVoiceRecorder } from "@/features/speak/use-voice-recorder";

type Turn = {
  speaker: "ai" | "student";
  text: string;
};

type SpeakSessionPanelProps = {
  sessionId: string;
  interactionMode: "text" | "voice";
  initialTurns: Turn[];
};

export function SpeakSessionPanel({
  sessionId,
  interactionMode,
  initialTurns,
}: SpeakSessionPanelProps) {
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>(initialTurns);
  const [review, setReview] = useState<null | {
    turns: Array<{
      turnIndex: number;
      speaker: string;
      text: string;
      inlineCorrections: Array<{ span: string; suggestion: string; reason: string }>;
    }>;
    vocabulary: Array<{ term: string; definition: string; translation: string }>;
  }>(null);
  const recorder = useVoiceRecorder();

  const aiTurns = useMemo(
    () => transcript.filter((turn) => turn.speaker === "ai"),
    [transcript]
  );

  useEffect(() => {
    const latestAiTurn = aiTurns.at(-1);
    if (!latestAiTurn || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
  }, [aiTurns]);

  async function handleSend() {
    setPending(true);
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
        studentTranscriptText?: string | null;
      };

      setTranscript((current) => [
        ...current,
        { speaker: "student", text: payload.studentTranscriptText?.trim() || input },
        { speaker: "ai", text: payload.aiResponseText },
      ]);
      setFeedback(payload.microCoaching ?? null);
      setInput("");
    } finally {
      setPending(false);
    }
  }

  async function handleVoiceTurn() {
    try {
      recorder.resetError();
      if (!recorder.recording) {
        await recorder.startRecording();
        return;
      }

      const audio = await recorder.stopRecording();
      if (!audio) {
        return;
      }

      setPending(true);
      const response = await fetch("/api/v1/speak/session/turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          studentInput: {
            audioDataUrl: audio.audioDataUrl,
            audioMimeType: audio.audioMimeType,
            durationSeconds: audio.durationSeconds,
          },
        }),
      });
      const payload = (await response.json()) as {
        aiResponseText: string;
        microCoaching?: string;
        studentTranscriptText?: string | null;
      };

      setTranscript((current) => [
        ...current,
        {
          speaker: "student",
          text: payload.studentTranscriptText?.trim() || "Voice response recorded.",
        },
        { speaker: "ai", text: payload.aiResponseText },
      ]);
      setFeedback(payload.microCoaching ?? null);
    } finally {
      setPending(false);
    }
  }

  async function handleFinish() {
    setPending(true);
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
    setReview(await reviewResponse.json());
    setCompleted(true);
    setPending(false);
  }

  async function savePhrase(phraseText: string) {
    await fetch(`/api/v1/speak/session/${sessionId}/phrases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phraseText,
        translationText: phraseText,
      }),
    });
  }

  function speakLatestAiTurn() {
    const latestAiTurn = aiTurns.at(-1);
    if (!latestAiTurn || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(latestAiTurn.text);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="border-border/70 bg-card/95">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-xl">Conversation</CardTitle>
          <Button variant="outline" size="sm" onClick={speakLatestAiTurn}>
            <Volume2 className="size-4" />
            Play AI
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[28rem] space-y-3 overflow-auto rounded-3xl bg-muted/25 p-4">
            {transcript.map((turn, index) => (
              <div
                key={`${turn.speaker}-${index}`}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  turn.speaker === "student"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-card text-foreground"
                }`}
              >
                {turn.text}
              </div>
            ))}
          </div>
          {completed ? null : (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Write your next answer."
              />
              <Button onClick={handleSend} disabled={pending || input.trim().length < 2}>
                Send
              </Button>
              {interactionMode === "voice" ? (
                <Button
                  variant={recorder.recording ? "accent" : "outline"}
                  onClick={handleVoiceTurn}
                  disabled={pending}
                >
                  <Mic className="size-4" />
                  {recorder.recording ? "Stop" : "Record"}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={handleFinish} disabled={pending}>
                Finish session
              </Button>
            </div>
          )}
          {recorder.error ? (
            <p className="text-sm text-destructive">{recorder.error}</p>
          ) : null}
          {feedback ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {feedback}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">Transcript review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!review ? (
            <p className="text-sm text-muted-foreground">
              Finish the session to unlock transcript review, inline corrections, and
              phrase saving.
            </p>
          ) : (
            <>
              <div className="space-y-4">
                {review.turns.map((turn) => (
                  <div key={turn.turnIndex} className="rounded-2xl bg-muted/30 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {turn.speaker}
                    </p>
                    <p className="mt-1 text-sm text-foreground">{turn.text}</p>
                    {turn.inlineCorrections.map((correction) => (
                      <p
                        key={`${turn.turnIndex}-${correction.span}`}
                        className="mt-2 text-xs text-muted-foreground"
                      >
                        Change &quot;{correction.span}&quot; to &quot;
                        {correction.suggestion}
                        &quot; · {correction.reason}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Save useful phrases</p>
                {review.vocabulary.map((item) => (
                  <button
                    key={item.term}
                    type="button"
                    onClick={() => savePhrase(item.term)}
                    className="w-full rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-left"
                  >
                    <p className="font-medium">{item.term}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.definition}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
