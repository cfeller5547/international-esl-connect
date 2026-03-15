"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, PhoneOff, Radio, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TranscriptTurn = {
  speaker: "ai" | "student";
  text: string;
};

type TranscriptReview = {
  turns: Array<{
    turnIndex: number;
    speaker: string;
    text: string;
    inlineCorrections: Array<{ span: string; suggestion: string; reason: string }>;
  }>;
  vocabulary: Array<{ term: string; definition: string; translation: string }>;
};

type SpeakRealtimeSessionPanelProps = {
  sessionId: string;
  initialTurns: TranscriptTurn[];
  scenarioTitle: string;
  scenarioSetup: string;
  starterPrompt: string | null;
};

type LiveState =
  | "idle"
  | "connecting"
  | "ready"
  | "listening"
  | "thinking"
  | "speaking"
  | "review"
  | "error";

function getStateCopy(state: LiveState) {
  switch (state) {
    case "connecting":
      return "Connecting to live voice";
    case "ready":
      return "Live and ready";
    case "listening":
      return "Listening";
    case "thinking":
      return "Thinking";
    case "speaking":
      return "Speaking";
    case "review":
      return "Session complete";
    case "error":
      return "Connection issue";
    default:
      return "Ready to start";
  }
}

function normalizePhrase(value: string) {
  return value.trim().toLowerCase();
}

export function SpeakRealtimeSessionPanel({
  sessionId,
  initialTurns,
  scenarioTitle,
  scenarioSetup,
  starterPrompt,
}: SpeakRealtimeSessionPanelProps) {
  const [transcript, setTranscript] = useState<TranscriptTurn[]>(initialTurns);
  const [state, setState] = useState<LiveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<TranscriptReview | null>(null);
  const [summary, setSummary] = useState<null | {
    strengths: string[];
    improvements: string[];
  }>(null);
  const [savedPhrases, setSavedPhrases] = useState<Set<string>>(new Set());
  const [finishing, setFinishing] = useState(false);

  const transcriptRef = useRef(transcript);
  const stateRef = useRef<LiveState>(state);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);
  const lastSyncedSignatureRef = useRef("");
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const pendingSyncRef = useRef<TranscriptTurn[] | null>(null);
  const pendingSyncSignatureRef = useRef("");
  const sessionStartedAtRef = useRef<number | null>(null);
  const closingSessionRef = useRef(false);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }

      pendingSyncRef.current = null;
      pendingSyncSignatureRef.current = "";
      connectionRef.current?.close();
      dataChannelRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    };
  }, []);

  const studentTurnCount = useMemo(
    () => transcript.filter((turn) => turn.speaker === "student").length,
    [transcript]
  );

  const syncTranscript = useCallback(async (turns: TranscriptTurn[]) => {
    const signature = JSON.stringify(turns);
    if (signature === lastSyncedSignatureRef.current) {
      return;
    }

    const response = await fetch(`/api/v1/speak/session/${sessionId}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        turns,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to sync the live transcript.");
    }

    lastSyncedSignatureRef.current = signature;
  }, [sessionId]);

  const flushPendingSync = useCallback(async () => {
    const turns = pendingSyncRef.current;
    const signature = pendingSyncSignatureRef.current;

    if (!turns || !signature) {
      syncInFlightRef.current = null;
      return;
    }

    pendingSyncRef.current = null;
    pendingSyncSignatureRef.current = "";

    if (signature === lastSyncedSignatureRef.current) {
      syncInFlightRef.current = null;
      if (pendingSyncRef.current) {
        syncInFlightRef.current = flushPendingSync();
      }
      return;
    }

    try {
      await syncTranscript(turns);
    } finally {
      if (pendingSyncRef.current) {
        syncInFlightRef.current = flushPendingSync();
      } else {
        syncInFlightRef.current = null;
      }
    }
  }, [syncTranscript]);

  const queueTranscriptSync = useCallback((turns: TranscriptTurn[]) => {
    const signature = JSON.stringify(turns);
    if (
      signature === lastSyncedSignatureRef.current ||
      signature === pendingSyncSignatureRef.current
    ) {
      return;
    }

    pendingSyncRef.current = turns.map((turn) => ({ ...turn }));
    pendingSyncSignatureRef.current = signature;

    if (!syncInFlightRef.current) {
      syncInFlightRef.current = flushPendingSync();
    }
  }, [flushPendingSync]);

  useEffect(() => {
    if (!["ready", "listening", "thinking", "speaking"].includes(state)) {
      return;
    }

    const currentTranscript = transcriptRef.current;
    if (currentTranscript.length === 0) {
      return;
    }

    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = window.setTimeout(() => {
      queueTranscriptSync(currentTranscript);
      void syncInFlightRef.current?.catch((syncError) => {
        setState("error");
        setError(
          syncError instanceof Error
          ? syncError.message
          : "Unable to sync the live transcript."
        );
      });
    }, 600);
  }, [queueTranscriptSync, state, transcript]);

  function pushTurn(turn: TranscriptTurn) {
    if (!turn.text.trim()) {
      return;
    }

    setTranscript((current) => {
      const next = [...current, { speaker: turn.speaker, text: turn.text.trim() }];
      transcriptRef.current = next;
      return next;
    });
  }

  function sendRealtimeEvent(event: Record<string, unknown>) {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      return;
    }

    channel.send(JSON.stringify(event));
  }

  function replayHistory() {
    for (const turn of transcriptRef.current) {
      sendRealtimeEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: turn.speaker === "student" ? "user" : "assistant",
          content: [
            {
              type: turn.speaker === "student" ? "input_text" : "output_text",
              text: turn.text,
            },
          ],
        },
      });
    }
  }

  function requestOpeningTurn() {
    const firstQuestion = starterPrompt ?? scenarioSetup;
    sendRealtimeEvent({
      type: "response.create",
      response: {
        instructions: `Greet the learner naturally, introduce the scenario "${scenarioTitle}", and ask the first clear opening question based on this prompt: ${firstQuestion}`,
      },
    });
  }

  function requestContinuationTurn() {
    sendRealtimeEvent({
      type: "response.create",
      response: {
        instructions:
          "Continue the conversation naturally from the current context with one short spoken response and one follow-up question.",
      },
    });
  }

  function handleRealtimeMessage(rawEvent: MessageEvent<string>) {
    const event = JSON.parse(rawEvent.data) as {
      type: string;
      transcript?: string;
      error?: { message?: string };
      response?: { status?: string; status_details?: { error?: { message?: string } } };
    };

    switch (event.type) {
      case "input_audio_buffer.speech_started":
        setState("listening");
        return;
      case "input_audio_buffer.speech_stopped":
        setState("thinking");
        return;
      case "response.created":
        setState("thinking");
        return;
      case "response.output_audio_transcript.done":
        if (event.transcript?.trim()) {
          pushTurn({
            speaker: "ai",
            text: event.transcript,
          });
        }
        setState("ready");
        return;
      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript?.trim()) {
          pushTurn({
            speaker: "student",
            text: event.transcript,
          });
        }
        setState("thinking");
        return;
      case "response.done":
        if (event.response?.status === "failed") {
          setState("error");
          setError(
            event.response.status_details?.error?.message ??
              "The live voice session failed unexpectedly."
          );
          return;
        }
        if (stateRef.current !== "review") {
          setState("ready");
        }
        return;
      case "error":
        setState("error");
        setError(event.error?.message ?? "The live voice session reported an error.");
        return;
      default:
        return;
    }
  }

  async function startLiveConversation() {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof RTCPeerConnection === "undefined"
    ) {
      setState("error");
      setError("This browser cannot open a live voice conversation.");
      return;
    }

    setError(null);
    setState("connecting");

    try {
      const credentialResponse = await fetch(`/api/v1/speak/session/${sessionId}/realtime`, {
        method: "POST",
      });
      const credentialPayload = (await credentialResponse.json()) as
        | { clientSecret?: string; model?: string; error?: { message?: string } }
        | undefined;

      if (!credentialResponse.ok || !credentialPayload?.clientSecret || !credentialPayload?.model) {
        throw new Error(
          credentialPayload?.error?.message ?? "Unable to start the live voice session."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const connection = new RTCPeerConnection();
      const channel = connection.createDataChannel("oai-events");
      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudioRef.current = remoteAudio;

      connection.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0] ?? null;
        void remoteAudio.play().catch(() => undefined);
      };

      channel.addEventListener("open", () => {
        replayHistory();

        if (transcriptRef.current.length === 0) {
          requestOpeningTurn();
        } else if (transcriptRef.current.at(-1)?.speaker === "student") {
          requestContinuationTurn();
        }

        setState("ready");
      });
      channel.addEventListener("message", handleRealtimeMessage);
      channel.addEventListener("close", () => {
        if (!closingSessionRef.current && stateRef.current !== "review") {
          setState("idle");
        }
      });

      stream.getTracks().forEach((track) => {
        connection.addTrack(track, stream);
      });

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);

      const answerResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentialPayload.clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!answerResponse.ok) {
        throw new Error("OpenAI rejected the live voice connection.");
      }

      const answerSdp = await answerResponse.text();
      await connection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });

      connectionRef.current = connection;
      dataChannelRef.current = channel;
      localStreamRef.current = stream;
      closingSessionRef.current = false;
      sessionStartedAtRef.current ??= Date.now();
      setState("ready");
    } catch (startError) {
      connectionRef.current?.close();
      dataChannelRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      setState("error");
      setError(
        startError instanceof Error
          ? startError.message
          : "Unable to open the live voice conversation."
      );
    }
  }

  async function finishSession() {
    if (finishing) {
      return;
    }

    setFinishing(true);
    setError(null);

    try {
      closingSessionRef.current = true;
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      sendRealtimeEvent({
        type: "response.cancel",
      });

      connectionRef.current?.close();
      dataChannelRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }

      pendingSyncRef.current = null;
      pendingSyncSignatureRef.current = "";
      await syncTranscript(transcriptRef.current);

      const durationSeconds = sessionStartedAtRef.current
        ? Math.max(1, Math.round((Date.now() - sessionStartedAtRef.current) / 1000))
        : undefined;

      const completionResponse = await fetch("/api/v1/speak/session/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          durationSeconds,
        }),
      });

      if (!completionResponse.ok) {
        throw new Error("Unable to complete the live session.");
      }

      const completionPayload = (await completionResponse.json()) as {
        summary?: {
          strengths?: string[];
          improvements?: string[];
        };
      };
      setSummary({
        strengths: completionPayload.summary?.strengths ?? [],
        improvements: completionPayload.summary?.improvements ?? [],
      });

      const reviewResponse = await fetch(`/api/v1/speak/session/${sessionId}/transcript`);
      if (!reviewResponse.ok) {
        throw new Error("Unable to load transcript review.");
      }
      setReview((await reviewResponse.json()) as TranscriptReview);

      setState("review");
    } catch (finishError) {
      setState("error");
      setError(
        finishError instanceof Error
          ? finishError.message
          : "Unable to finish the live session."
      );
    } finally {
      setFinishing(false);
    }
  }

  async function savePhrase(phraseText: string) {
    const response = await fetch(`/api/v1/speak/session/${sessionId}/phrases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phraseText,
        translationText: phraseText,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to save that phrase.");
    }

    setSavedPhrases((current) => {
      const next = new Set(current);
      next.add(normalizePhrase(phraseText));
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/95">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs uppercase">
                Speak live
              </Badge>
              <CardTitle className="text-3xl leading-tight">{scenarioTitle}</CardTitle>
              <p className="max-w-3xl text-sm text-muted-foreground">{scenarioSetup}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={state === "error" ? "destructive" : "outline"}
                className="rounded-full px-3 py-1 text-xs"
              >
                <Radio className="mr-1 size-3.5" />
                {getStateCopy(state)}
              </Badge>
              <Button
                variant="outline"
                onClick={finishSession}
                disabled={
                  finishing ||
                  studentTurnCount === 0 ||
                  state === "connecting" ||
                  state === "review"
                }
              >
                <PhoneOff className="size-4" />
                {finishing
                  ? "Wrapping up..."
                  : state === "review"
                    ? "Session finished"
                    : "Finish session"}
              </Button>
            </div>
          </div>

          {starterPrompt ? (
            <div className="rounded-3xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Opening prompt: <span className="font-medium text-foreground">{starterPrompt}</span>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          {state === "idle" ? (
            <div className="rounded-[2rem] border border-dashed border-border/70 bg-muted/20 px-6 py-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-foreground">
                    Start a real back-and-forth voice conversation
                  </p>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    The AI will speak back naturally, listen for the end of your turn, and
                    keep the conversation moving without manual send buttons.
                  </p>
                </div>
                <Button size="lg" onClick={startLiveConversation}>
                  <Mic className="size-4" />
                  Start live conversation
                </Button>
              </div>
            </div>
          ) : null}

          <div className="max-h-[32rem] space-y-3 overflow-auto rounded-[2rem] border border-border/70 bg-muted/20 p-4">
            {transcript.length === 0 && state !== "idle" ? (
              <div className="rounded-3xl bg-card px-4 py-3 text-sm text-muted-foreground">
                The session is live. The AI will greet you first.
              </div>
            ) : null}
            {transcript.map((turn, index) => (
              <div
                key={`${turn.speaker}-${index}`}
                className={`max-w-[85%] rounded-[1.5rem] px-4 py-3 text-sm shadow-sm ${
                  turn.speaker === "student"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-card text-foreground"
                }`}
              >
                {turn.text}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-muted/15 px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {state === "listening"
                  ? "Speak naturally. The AI will answer when you pause."
                  : state === "speaking"
                    ? "The AI is responding out loud right now."
                    : state === "thinking"
                      ? "The AI is preparing the next spoken reply."
                      : state === "review"
                        ? "Review your session and save any useful phrases."
                        : "Your microphone stays live for the conversation once connected."}
              </p>
              <p className="text-xs text-muted-foreground">
                Student turns recorded: {studentTurnCount}
              </p>
            </div>
            {state === "error" ? (
              <Button variant="outline" onClick={startLiveConversation}>
                Retry connection
              </Button>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {review ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-border/70 bg-card/95">
            <CardHeader className="space-y-3">
              <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs uppercase">
                Post-session review
              </Badge>
              <CardTitle className="text-2xl">See what to keep and what to refine</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      What worked
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      {summary.strengths[0] ?? "You stayed in the conversation and kept it moving."}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Next improvement
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                      {summary.improvements[0] ??
                        "Try one more round and add slightly more detail to each answer."}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-4">
                {review.turns.map((turn) => (
                  <div key={turn.turnIndex} className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {turn.speaker}
                    </p>
                    <p className="mt-2 text-sm text-foreground">{turn.text}</p>
                    {turn.inlineCorrections.slice(0, 2).map((correction) => (
                      <div
                        key={`${turn.turnIndex}-${correction.span}`}
                        className="mt-3 rounded-2xl bg-card px-3 py-2 text-sm text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">Try:</span> {correction.suggestion}
                        <span className="mx-2 text-muted-foreground/70">|</span>
                        {correction.reason}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95">
            <CardHeader className="space-y-3">
              <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs uppercase">
                Phrase bank
              </Badge>
              <CardTitle className="text-2xl">Save useful language from the session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {review.vocabulary.map((item) => {
                const isSaved = savedPhrases.has(normalizePhrase(item.term));

                return (
                  <button
                    key={item.term}
                    type="button"
                    onClick={() => void savePhrase(item.term)}
                    disabled={isSaved}
                    className="w-full rounded-3xl border border-border/70 bg-muted/20 px-4 py-4 text-left transition hover:bg-muted/35 disabled:cursor-default disabled:opacity-70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{item.term}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.definition}</p>
                      </div>
                      <Badge variant={isSaved ? "default" : "secondary"}>
                        {isSaved ? "Saved" : "Save"}
                      </Badge>
                    </div>
                  </button>
                );
              })}
              {review.vocabulary.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                  <Sparkles className="mb-2 size-4" />
                  No standout phrases were extracted from this round yet.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
