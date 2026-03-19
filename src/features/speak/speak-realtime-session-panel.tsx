"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, Mic, PhoneOff, Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SpeakCompletionCard,
  SpeakReviewPanel,
  SpeakTranscriptPane,
} from "@/features/speak/speak-session-ui";
import {
  buildSpeakHelpPrompt,
  getSpeakCounterpartLabel,
  normalizeSpeakTurnSignals,
  type SpeakMissionDetails,
  type SpeakSessionReview,
  type SpeakTranscriptTurn,
} from "@/lib/speak";
import { trackClientEvent } from "@/lib/client-analytics";

type SpeakRealtimeSessionPanelProps = {
  sessionId: string;
  mission: SpeakMissionDetails;
  initialTurns: SpeakTranscriptTurn[];
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
      return "Connecting";
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

export function SpeakRealtimeSessionPanel({
  sessionId,
  mission,
  initialTurns,
}: SpeakRealtimeSessionPanelProps) {
  const [transcript, setTranscript] = useState<SpeakTranscriptTurn[]>(initialTurns);
  const [state, setState] = useState<LiveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<SpeakSessionReview | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [helpPrompt, setHelpPrompt] = useState<string | null>(null);

  const transcriptRef = useRef(transcript);
  const stateRef = useRef<LiveState>(state);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);
  const lastSyncedSignatureRef = useRef("");
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const pendingSyncRef = useRef<SpeakTranscriptTurn[] | null>(null);
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
  const counterpartLabel = getSpeakCounterpartLabel(mission.counterpartRole);
  const showCounterpart = mission.mode === "guided";

  const applySyncedCoachings = useCallback(
    (
      coachings: Array<{
        turnIndex: number;
        microCoaching: string;
        coachLabel: string;
        turnSignals: {
          fluencyIssue?: boolean;
          grammarIssue?: boolean;
          vocabOpportunity?: boolean;
        };
      }>
    ) => {
      if (coachings.length === 0) {
        return;
      }

      setTranscript((current) =>
        current.map((turn) => {
          const coaching = coachings.find((entry) => entry.turnIndex === turn.turnIndex);

          if (!coaching || turn.speaker !== "student") {
            return turn;
          }

          return {
            ...turn,
            coaching: {
              label: coaching.coachLabel,
              note: coaching.microCoaching,
              signals: normalizeSpeakTurnSignals(coaching.turnSignals),
            },
          };
        })
      );
    },
    []
  );

  const syncTranscript = useCallback(
    async (turns: SpeakTranscriptTurn[]) => {
      const signature = JSON.stringify(turns.map(({ speaker, text }) => ({ speaker, text })));
      if (signature === lastSyncedSignatureRef.current) {
        return;
      }

      const response = await fetch(`/api/v1/speak/session/${sessionId}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          turns: turns.map((turn) => ({
            speaker: turn.speaker,
            text: turn.text,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to sync the live transcript.");
      }

      const payload = (await response.json()) as {
        studentCoachings?: Array<{
          turnIndex: number;
          microCoaching: string;
          coachLabel: string;
          turnSignals: {
            fluencyIssue?: boolean;
            grammarIssue?: boolean;
            vocabOpportunity?: boolean;
          };
        }>;
      };

      applySyncedCoachings(payload.studentCoachings ?? []);
      lastSyncedSignatureRef.current = signature;
    },
    [applySyncedCoachings, sessionId]
  );

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

  const queueTranscriptSync = useCallback(
    (turns: SpeakTranscriptTurn[]) => {
      const signature = JSON.stringify(turns.map(({ speaker, text }) => ({ speaker, text })));
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
    },
    [flushPendingSync]
  );

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

  function pushTurn(turn: { speaker: "ai" | "student"; text: string }) {
    if (!turn.text.trim()) {
      return;
    }

    setHelpPrompt(null);
    setTranscript((current) => {
      const next = [
        ...current,
        {
          turnIndex: current.length + 1,
          speaker: turn.speaker,
          text: turn.text.trim(),
          coaching: null,
        },
      ];
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
    sendRealtimeEvent({
      type: "response.create",
      response: {
        instructions: `Open the conversation naturally using this opening line as your guide: ${mission.openingPrompt ?? mission.scenarioSetup}`,
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

      await completionResponse.json();

      const reviewResponse = await fetch(`/api/v1/speak/session/${sessionId}/transcript`);
      if (!reviewResponse.ok) {
        throw new Error("Unable to load transcript review.");
      }
      setReview((await reviewResponse.json()) as SpeakSessionReview);

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

  function revealHelpPrompt() {
    setHelpPrompt(
      buildSpeakHelpPrompt({
        mission,
        latestAiTurn:
          transcriptRef.current
            .filter((turn) => turn.speaker === "ai")
            .at(-1)?.text ?? null,
        studentTurnCount,
      })
    );

    trackClientEvent({
      eventName: "speak_help_requested",
      route: `/app/speak/session/${sessionId}`,
      properties: {
        input_mode: "voice",
      },
    });
  }

  const showMissionBrief =
    mission.mode === "guided" && state === "idle" && transcript.length === 0 && !review;
  const showActiveSession = !showMissionBrief && state !== "review";

  return (
    <div className="space-y-6">
      {showMissionBrief ? (
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs uppercase">
                Speak live
              </Badge>
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                {counterpartLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                <Radio className="mr-1 size-3.5" />
                {getStateCopy(state)}
              </Badge>
            </div>
            <div>
              <CardTitle className="text-3xl leading-tight">{mission.scenarioTitle}</CardTitle>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{mission.scenarioSetup}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-5 rounded-[2rem] border border-dashed border-border/70 bg-muted/20 px-6 py-8">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] border border-border/70 bg-card/90 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Speaking goal
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    {mission.canDoStatement ?? mission.performanceTask}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-border/70 bg-card/90 p-4">
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
                <div className="rounded-[1.5rem] border border-border/70 bg-card/90 px-4 py-3 text-sm text-muted-foreground">
                  Opening line: <span className="font-medium text-foreground">{mission.openingPrompt}</span>
                </div>
              ) : null}

              <Button size="lg" onClick={startLiveConversation}>
                <Mic className="size-4" />
                Start live conversation
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showActiveSession ? (
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs uppercase">
                    {mission.mode === "free_speech" ? "Free speech live" : "Speak live"}
                  </Badge>
                  {showCounterpart ? (
                    <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                      {counterpartLabel}
                    </Badge>
                  ) : null}
                  <Badge
                    variant={state === "error" ? "destructive" : "outline"}
                    className="rounded-full px-3 py-1 text-xs"
                  >
                    <Radio className="mr-1 size-3.5" />
                    {getStateCopy(state)}
                  </Badge>
                </div>
                <div>
                  <CardTitle className="text-3xl leading-tight">{mission.scenarioTitle}</CardTitle>
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                    {mission.mode === "free_speech"
                      ? mission.contextHint ?? "Start from a real topic and let the conversation move naturally."
                      : mission.canDoStatement ?? mission.performanceTask}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={revealHelpPrompt}>
                  <Lightbulb className="size-4" />
                  Help me
                </Button>
                {state === "idle" ? (
                  <Button onClick={startLiveConversation}>
                    <Mic className="size-4" />
                    Start live conversation
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={finishSession}
                  disabled={finishing || studentTurnCount === 0 || state === "connecting"}
                >
                  <PhoneOff className="size-4" />
                  {finishing ? "Wrapping up..." : "Finish session"}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <SpeakTranscriptPane turns={transcript} />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-border/70 bg-muted/15 px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {state === "idle"
                    ? "Start live voice when you are ready. The conversation will open with one natural question."
                    : state === "listening"
                      ? "Speak naturally. The AI will answer when you pause."
                      : state === "speaking"
                        ? "The AI is responding out loud right now."
                        : state === "thinking"
                          ? "The AI is preparing the next spoken reply."
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
              ) : state === "idle" ? (
                <Button variant="outline" onClick={startLiveConversation}>
                  Start now
                </Button>
              ) : null}
            </div>

            {helpPrompt ? (
              <div className="rounded-[1.5rem] border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                {helpPrompt}
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {state === "review" ? (
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
