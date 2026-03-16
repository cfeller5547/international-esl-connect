"use client";

import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

import { isClarificationRequest } from "@/lib/conversation-utils";

export type AssessmentVoiceState =
  | "idle"
  | "starting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

type AssessmentConversationTurn = {
  speaker: "ai" | "student";
  text: string;
  countsTowardProgress?: boolean;
};

type RealtimeCredentialPayload =
  | {
      clientSecret?: string;
      model?: string;
      error?: { message?: string };
    }
  | undefined;

type UseAssessmentLiveVoiceArgs = {
  assessmentAttemptId: string;
  realtimeEndpoint: string;
  openingTurn: string;
  transcript: AssessmentConversationTurn[];
  setTranscript: Dispatch<SetStateAction<AssessmentConversationTurn[]>>;
  setConversationDurationSeconds: Dispatch<SetStateAction<number>>;
  setError: (message: string | null) => void;
};

function supportsLiveVoice() {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof RTCPeerConnection !== "undefined"
  );
}

function toRoundedSeconds(milliseconds: number) {
  return Math.max(0, Math.round(milliseconds / 1000));
}

export function useAssessmentLiveVoice({
  assessmentAttemptId,
  realtimeEndpoint,
  openingTurn,
  transcript,
  setTranscript,
  setConversationDurationSeconds,
  setError,
}: UseAssessmentLiveVoiceArgs) {
  const [voiceState, setVoiceState] = useState<AssessmentVoiceState>("idle");
  const [liveActive, setLiveActive] = useState(false);

  const transcriptRef = useRef(transcript);
  const voiceStateRef = useRef(voiceState);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const connectionStartedAtRef = useRef<number | null>(null);
  const accumulatedMillisecondsRef = useRef(0);
  const closingConnectionRef = useRef(false);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    return () => {
      accumulatedMillisecondsRef.current += consumeActiveMilliseconds();
      teardownConnection();
    };
  }, []);

  function consumeActiveMilliseconds() {
    if (!connectionStartedAtRef.current) {
      return 0;
    }

    const elapsed = Date.now() - connectionStartedAtRef.current;
    connectionStartedAtRef.current = null;
    return Math.max(0, elapsed);
  }

  function updateDurationSnapshot() {
    const activeMilliseconds = connectionStartedAtRef.current
      ? Math.max(0, Date.now() - connectionStartedAtRef.current)
      : 0;

    setConversationDurationSeconds(
      toRoundedSeconds(accumulatedMillisecondsRef.current + activeMilliseconds)
    );
  }

  function teardownConnection() {
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
    setLiveActive(false);
  }

  function appendTurn(turn: AssessmentConversationTurn) {
    const text = turn.text.trim();
    if (!text) {
      return;
    }

    setTranscript((current) => {
      const next = [...current, { ...turn, text }];
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
        instructions: `Greet the learner naturally as Maya and open the interview with this exact introduction and first question: ${openingTurn}`,
      },
    });
  }

  function requestContinuationTurn() {
    sendRealtimeEvent({
      type: "response.create",
      response: {
        instructions:
          "Continue the placement interview naturally with one short spoken response and one short follow-up question.",
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
        setVoiceState("listening");
        updateDurationSnapshot();
        return;
      case "input_audio_buffer.speech_stopped":
        setVoiceState("thinking");
        updateDurationSnapshot();
        return;
      case "response.created":
        setVoiceState("thinking");
        updateDurationSnapshot();
        return;
      case "response.output_audio.delta":
        setVoiceState("speaking");
        return;
      case "response.output_audio_transcript.done":
        if (event.transcript?.trim()) {
          appendTurn({ speaker: "ai", text: event.transcript });
        }
        setVoiceState("idle");
        updateDurationSnapshot();
        return;
      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript?.trim()) {
          appendTurn({
            speaker: "student",
            text: event.transcript,
            countsTowardProgress: !isClarificationRequest(event.transcript),
          });
        }
        setVoiceState("thinking");
        updateDurationSnapshot();
        return;
      case "response.done":
        if (event.response?.status === "failed") {
          setVoiceState("error");
          setError(
            event.response.status_details?.error?.message ??
              "The live voice interview failed unexpectedly."
          );
          return;
        }
        if (voiceStateRef.current !== "error") {
          setVoiceState("idle");
        }
        updateDurationSnapshot();
        return;
      case "error":
        setVoiceState("error");
        setError(event.error?.message ?? "The live voice interview reported an error.");
        return;
      default:
        return;
    }
  }

  async function pauseLiveConversation() {
    accumulatedMillisecondsRef.current += consumeActiveMilliseconds();
    updateDurationSnapshot();
    closingConnectionRef.current = true;
    sendRealtimeEvent({ type: "response.cancel" });
    teardownConnection();
    setVoiceState("idle");
  }

  async function startLiveConversation() {
    if (!assessmentAttemptId) {
      return;
    }

    if (!supportsLiveVoice()) {
      setVoiceState("error");
      setError("This browser can't run the live AI voice interview.");
      return;
    }

    setError(null);
    setVoiceState("starting");

    try {
      const credentialResponse = await fetch(realtimeEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentAttemptId }),
      });
      const credentialPayload = (await credentialResponse.json()) as RealtimeCredentialPayload;

      if (
        !credentialResponse.ok ||
        !credentialPayload?.clientSecret ||
        !credentialPayload?.model
      ) {
        throw new Error(
          credentialPayload?.error?.message ??
            "Unable to start the live AI voice interview."
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

        setVoiceState("idle");
      });

      channel.addEventListener("message", handleRealtimeMessage);
      channel.addEventListener("close", () => {
        if (!closingConnectionRef.current && voiceStateRef.current !== "error") {
          accumulatedMillisecondsRef.current += consumeActiveMilliseconds();
          updateDurationSnapshot();
          setVoiceState("idle");
          setLiveActive(false);
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
        throw new Error("OpenAI rejected the live voice interview.");
      }

      const answerSdp = await answerResponse.text();
      await connection.setRemoteDescription({ type: "answer", sdp: answerSdp });

      connectionRef.current = connection;
      dataChannelRef.current = channel;
      localStreamRef.current = stream;
      closingConnectionRef.current = false;
      connectionStartedAtRef.current = Date.now();
      setLiveActive(true);
      setVoiceState("idle");
      updateDurationSnapshot();
    } catch (startError) {
      accumulatedMillisecondsRef.current += consumeActiveMilliseconds();
      teardownConnection();
      setVoiceState("error");
      setError(
        startError instanceof Error
          ? startError.message
          : "Unable to open the live AI voice interview."
      );
    }
  }

  return {
    isSupported: supportsLiveVoice(),
    liveActive,
    voiceState,
    startLiveConversation,
    pauseLiveConversation,
  };
}
