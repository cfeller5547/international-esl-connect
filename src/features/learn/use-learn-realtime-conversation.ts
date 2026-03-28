"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { LiveStudentTurnDisposition, LiveStudentTurnReasonCode } from "@/lib/conversation-utils";
import type { SpeakTurnCoaching } from "@/lib/speak";
import {
  createAmbientNoiseMonitor,
  getPreferredRealtimeAudioConstraints,
  type AmbientNoiseLevel,
} from "@/features/voice/live-voice-audio";

export type ConversationTurn = {
  speaker: "ai" | "student";
  text: string;
  coaching?: SpeakTurnCoaching | null;
  disposition?: LiveStudentTurnDisposition | null;
  countsTowardProgress?: boolean;
  reasonCode?: LiveStudentTurnReasonCode | null;
};

export type RealtimeState =
  | "idle"
  | "connecting"
  | "ready"
  | "listening"
  | "still_listening"
  | "thinking"
  | "speaking"
  | "didnt_catch_that"
  | "noisy_room"
  | "error";

function supportsLiveVoice() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof RTCPeerConnection !== "undefined"
  );
}

function cloneTurns(turns: ConversationTurn[]) {
  return turns.map((turn) => ({ ...turn }));
}

type UseLearnRealtimeConversationArgs = {
  sessionId: string | null;
  turns: ConversationTurn[];
  setTurns: Dispatch<SetStateAction<ConversationTurn[]>>;
  openingQuestion: string;
  setError: Dispatch<SetStateAction<string | null>>;
  onFallbackToText: (message: string) => void;
};

export function useLearnRealtimeConversation({
  sessionId,
  turns,
  setTurns,
  openingQuestion,
  setError,
  onFallbackToText,
}: UseLearnRealtimeConversationArgs) {
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("idle");
  const [liveConnected, setLiveConnected] = useState(false);
  const [ambientNoise, setAmbientNoise] = useState<AmbientNoiseLevel>("quiet");
  const [repairNotice, setRepairNotice] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(
    turns.filter((turn) => turn.speaker === "ai").at(-1)?.text ?? null
  );

  const turnsRef = useRef(turns);
  const sessionIdRef = useRef(sessionId);
  const realtimeStateRef = useRef(realtimeState);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const noiseCleanupRef = useRef<(() => void) | null>(null);
  const listeningTimerRef = useRef<number | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);
  const lastSyncedSignatureRef = useRef("");
  const syncInFlightRef = useRef<Promise<void> | null>(null);
  const pendingSyncRef = useRef<ConversationTurn[] | null>(null);
  const pendingSyncSignatureRef = useRef("");
  const closingConnectionRef = useRef(false);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    realtimeStateRef.current = realtimeState;
  }, [realtimeState]);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
      if (listeningTimerRef.current) {
        window.clearTimeout(listeningTimerRef.current);
      }

      noiseCleanupRef.current?.();
      connectionRef.current?.close();
      dataChannelRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    };
  }, []);

  const applySyncedTurnFeedback = useCallback(
    (lastStudentTurn?: {
      turnIndex: number;
      disposition:
        | "accepted_answer"
        | "clarification_request"
        | "acknowledgement_only"
        | "noise_or_unintelligible"
        | "off_task_short";
      countsTowardProgress: boolean;
      coachLabel: string | null;
      coachNote: string | null;
      reasonCode: string;
    } | null) => {
      if (!lastStudentTurn) {
        return;
      }

      setTurns((current) => {
        const next = current.map((turn, index) => {
          if (turn.speaker !== "student" || index + 1 !== lastStudentTurn.turnIndex) {
            return turn;
          }

          return {
            ...turn,
            coaching: lastStudentTurn.coachLabel
              ? {
                  label: lastStudentTurn.coachLabel,
                  note:
                    lastStudentTurn.coachNote ??
                    "Keep the next answer clear and direct.",
                  signals: {
                    fluencyIssue: false,
                    grammarIssue: false,
                    vocabOpportunity: false,
                  },
                }
              : null,
            disposition: lastStudentTurn.disposition,
            countsTowardProgress: lastStudentTurn.countsTowardProgress,
            reasonCode: lastStudentTurn.reasonCode as LiveStudentTurnReasonCode,
          };
        });

        turnsRef.current = next;
        return next;
      });

      if (!lastStudentTurn.countsTowardProgress) {
        setRepairNotice(lastStudentTurn.coachNote ?? "Say that again in one short sentence.");
        setRealtimeState(
          lastStudentTurn.disposition === "noise_or_unintelligible"
            ? "noisy_room"
            : "didnt_catch_that"
        );
      } else {
        setRepairNotice(null);
      }
    },
    [setTurns]
  );

  const syncTranscript = useCallback(async (transcript: ConversationTurn[]) => {
    const activeSessionId = sessionIdRef.current;
    const payloadTurns = transcript.map((turn) => ({
      speaker: turn.speaker,
      text: turn.text,
    }));
    const signature = JSON.stringify(payloadTurns);
    if (!activeSessionId || signature === lastSyncedSignatureRef.current) {
      return;
    }

    const response = await fetch(`/api/v1/learn/curriculum/speaking/${activeSessionId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turns: payloadTurns }),
    });

    if (!response.ok) {
      throw new Error("Unable to sync the live transcript.");
    }

    const payload = (await response.json()) as {
      lastStudentTurn?: {
        turnIndex: number;
        disposition:
          | "accepted_answer"
          | "clarification_request"
          | "acknowledgement_only"
          | "noise_or_unintelligible"
          | "off_task_short";
        countsTowardProgress: boolean;
        coachLabel: string | null;
        coachNote: string | null;
        reasonCode: string;
      } | null;
    };

    applySyncedTurnFeedback(payload.lastStudentTurn ?? null);
    lastSyncedSignatureRef.current = signature;
  }, [applySyncedTurnFeedback]);

  const flushPendingSync = useCallback(async () => {
    const transcript = pendingSyncRef.current;
    const signature = pendingSyncSignatureRef.current;

    if (!transcript || !signature) {
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
      await syncTranscript(transcript);
    } finally {
      if (pendingSyncRef.current) {
        syncInFlightRef.current = flushPendingSync();
      } else {
        syncInFlightRef.current = null;
      }
    }
  }, [syncTranscript]);

  const queueTranscriptSync = useCallback((transcript: ConversationTurn[]) => {
    const signature = JSON.stringify(
      transcript.map((turn) => ({
        speaker: turn.speaker,
        text: turn.text,
      }))
    );
    if (
      signature === lastSyncedSignatureRef.current ||
      signature === pendingSyncSignatureRef.current
    ) {
      return;
    }

    pendingSyncRef.current = cloneTurns(transcript);
    pendingSyncSignatureRef.current = signature;

    if (!syncInFlightRef.current) {
      syncInFlightRef.current = flushPendingSync();
    }
  }, [flushPendingSync]);

  useEffect(() => {
    if (
      !liveConnected ||
      !["ready", "listening", "still_listening", "thinking", "speaking", "noisy_room"].includes(
        realtimeState
      )
    ) {
      return;
    }

    if (turns.length === 0) {
      return;
    }

    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = window.setTimeout(() => {
      queueTranscriptSync(turnsRef.current);
      void syncInFlightRef.current?.catch((syncError) => {
        setRealtimeState("error");
        setError(
          syncError instanceof Error
            ? syncError.message
            : "Unable to sync the live transcript."
        );
      });
    }, 600);
  }, [liveConnected, queueTranscriptSync, realtimeState, setError, turns]);

  function appendTurn(turn: ConversationTurn) {
    if (!turn.text.trim()) {
      return;
    }

    setTurns((current) => {
      const trimmedText = turn.text.trim();
      if (turn.speaker === "ai" && current.length === 1 && current[0]?.speaker === "ai") {
        const next = [
          {
            ...current[0],
            text: trimmedText,
          },
        ];
        turnsRef.current = next;
        setLastQuestion(trimmedText);
        return next;
      }

      const next = [...current, { ...turn, text: trimmedText }];
      turnsRef.current = next;
      if (turn.speaker === "ai") {
        setLastQuestion(trimmedText);
      }
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
    for (const turn of turnsRef.current) {
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
        instructions: `Open the scenario naturally and ask this question: ${openingQuestion}`,
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

  function requestRepeatedQuestion() {
    sendRealtimeEvent({
      type: "response.create",
      response: {
        instructions:
          "Repeat your last question in simpler English, in one short sentence, and wait for the learner's answer.",
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
        if (listeningTimerRef.current) {
          window.clearTimeout(listeningTimerRef.current);
        }
        setRealtimeState("listening");
        listeningTimerRef.current = window.setTimeout(() => {
          setRealtimeState((current) => (current === "listening" ? "still_listening" : current));
        }, 1800);
        return;
      case "input_audio_buffer.speech_stopped":
        if (listeningTimerRef.current) {
          window.clearTimeout(listeningTimerRef.current);
        }
        setRealtimeState("thinking");
        return;
      case "response.created":
        setRealtimeState("thinking");
        return;
      case "response.output_audio.delta":
        setRealtimeState("speaking");
        return;
      case "response.output_audio_transcript.done":
        if (event.transcript?.trim()) {
          appendTurn({ speaker: "ai", text: event.transcript });
        }
        setRealtimeState("ready");
        return;
      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript?.trim()) {
          appendTurn({ speaker: "student", text: event.transcript });
        }
        setRealtimeState("thinking");
        return;
      case "response.done":
        if (event.response?.status === "failed") {
          setRealtimeState("error");
          setError(
            event.response.status_details?.error?.message ??
              "The live voice session failed unexpectedly."
          );
          return;
        }
        setRealtimeState("ready");
        return;
      case "error":
        setRealtimeState("error");
        setError(event.error?.message ?? "The live voice session reported an error.");
        return;
      default:
        return;
    }
  }

  async function closeLiveConnection(options?: { syncTranscriptBeforeClose?: boolean }) {
    closingConnectionRef.current = true;

    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    if (listeningTimerRef.current) {
      window.clearTimeout(listeningTimerRef.current);
    }

    sendRealtimeEvent({ type: "response.cancel" });

    connectionRef.current?.close();
    dataChannelRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    noiseCleanupRef.current?.();
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    connectionRef.current = null;
    dataChannelRef.current = null;
    localStreamRef.current = null;
    remoteAudioRef.current = null;
    setLiveConnected(false);
    setRealtimeState("idle");

    if (options?.syncTranscriptBeforeClose) {
      pendingSyncRef.current = null;
      pendingSyncSignatureRef.current = "";
      await syncTranscript(turnsRef.current);
    }
  }

  async function startLiveConversation(options?: { sessionIdOverride?: string; autoFallback?: boolean }) {
    const activeSessionId = options?.sessionIdOverride ?? sessionIdRef.current;
    if (!activeSessionId) {
      return;
    }

    if (!supportsLiveVoice()) {
      onFallbackToText(
        "This browser cannot open a live voice conversation, so you can keep going by typing."
      );
      return;
    }

    setError(null);
    setRealtimeState("connecting");

    try {
      const credentialResponse = await fetch(
        `/api/v1/learn/curriculum/speaking/${activeSessionId}/realtime`,
        { method: "POST" }
      );
      const credentialPayload = (await credentialResponse.json()) as
        | { clientSecret?: string; model?: string; error?: { message?: string } }
        | undefined;

      if (!credentialResponse.ok || !credentialPayload?.clientSecret || !credentialPayload?.model) {
        throw new Error(
          credentialPayload?.error?.message ?? "Unable to start the live voice session."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: getPreferredRealtimeAudioConstraints(),
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

        if (turnsRef.current.length === 0) {
          requestOpeningTurn();
        } else if (turnsRef.current.at(-1)?.speaker === "student") {
          requestContinuationTurn();
        }

        setRealtimeState("ready");
      });
      channel.addEventListener("message", handleRealtimeMessage);
      channel.addEventListener("close", () => {
        if (!closingConnectionRef.current && realtimeStateRef.current !== "error") {
          setRealtimeState("idle");
        }
      });

      stream.getTracks().forEach((track) => connection.addTrack(track, stream));

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
      await connection.setRemoteDescription({ type: "answer", sdp: answerSdp });

      connectionRef.current = connection;
      dataChannelRef.current = channel;
      localStreamRef.current = stream;
      noiseCleanupRef.current?.();
      noiseCleanupRef.current = createAmbientNoiseMonitor(stream, (level) => {
        setAmbientNoise(level);
        setRealtimeState((current) => {
          if (current === "speaking" || current === "error") {
            return current;
          }

          if (level === "very_noisy") {
            return "noisy_room";
          }

          if (current === "noisy_room") {
            return "ready";
          }

          return current;
        });
      });
      closingConnectionRef.current = false;
      setLiveConnected(true);
      setRealtimeState("ready");
    } catch (startError) {
      connectionRef.current?.close();
      dataChannelRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      noiseCleanupRef.current?.();
      connectionRef.current = null;
      dataChannelRef.current = null;
      localStreamRef.current = null;

      const message =
        startError instanceof Error
          ? startError.message
          : "Unable to open the live voice conversation.";

      if (options?.autoFallback) {
        onFallbackToText("Live voice was unavailable, so you can keep going by typing.");
        setError(null);
        return;
      }

      setRealtimeState("error");
      setError(message);
    }
  }

  return {
    liveConnected,
    realtimeState,
    ambientNoise,
    repairNotice,
    lastQuestion,
    startLiveConversation,
    closeLiveConnection,
    syncTranscript,
    requestRepeatedQuestion,
  };
}
