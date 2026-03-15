"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type ConversationTurn = {
  speaker: "ai" | "student";
  text: string;
};

export type RealtimeState =
  | "idle"
  | "connecting"
  | "ready"
  | "listening"
  | "thinking"
  | "speaking"
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

  const turnsRef = useRef(turns);
  const sessionIdRef = useRef(sessionId);
  const realtimeStateRef = useRef(realtimeState);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
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

      connectionRef.current?.close();
      dataChannelRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    };
  }, []);

  const syncTranscript = useCallback(async (transcript: ConversationTurn[]) => {
    const activeSessionId = sessionIdRef.current;
    const signature = JSON.stringify(transcript);
    if (!activeSessionId || signature === lastSyncedSignatureRef.current) {
      return;
    }

    const response = await fetch(`/api/v1/learn/curriculum/speaking/${activeSessionId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turns: transcript }),
    });

    if (!response.ok) {
      throw new Error("Unable to sync the live transcript.");
    }

    lastSyncedSignatureRef.current = signature;
  }, []);

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
    const signature = JSON.stringify(transcript);
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
    if (!liveConnected || !["ready", "listening", "thinking", "speaking"].includes(realtimeState)) {
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
      const next = [...current, { speaker: turn.speaker, text: turn.text.trim() }];
      turnsRef.current = next;
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

  function handleRealtimeMessage(rawEvent: MessageEvent<string>) {
    const event = JSON.parse(rawEvent.data) as {
      type: string;
      transcript?: string;
      error?: { message?: string };
      response?: { status?: string; status_details?: { error?: { message?: string } } };
    };

    switch (event.type) {
      case "input_audio_buffer.speech_started":
        setRealtimeState("listening");
        return;
      case "input_audio_buffer.speech_stopped":
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

    sendRealtimeEvent({ type: "response.cancel" });

    connectionRef.current?.close();
    dataChannelRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
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
      closingConnectionRef.current = false;
      setLiveConnected(true);
      setRealtimeState("ready");
    } catch (startError) {
      connectionRef.current?.close();
      dataChannelRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
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
    startLiveConversation,
    closeLiveConnection,
    syncTranscript,
  };
}
