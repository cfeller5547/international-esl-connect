"use client";

import { useEffect, useRef, useState } from "react";

export type AssessmentVoiceState =
  | "idle"
  | "starting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

type SpeechRecognitionResultAlternative = {
  transcript?: string;
};

type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionResultAlternative>;

type SpeechRecognitionEventLike = {
  results?: ArrayLike<SpeechRecognitionResultLike>;
  timeStamp?: number;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((event?: { timeStamp?: number }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const browserWindow = window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

function supportsContinuousVoice() {
  return getSpeechRecognitionConstructor() !== null;
}

function getTranscriptFromRecognitionEvent(event: SpeechRecognitionEventLike) {
  const transcripts =
    Array.from(event.results ?? []).flatMap((result) =>
      Array.from(result ?? []).map((alternative) => alternative.transcript ?? "")
    ) ?? [];

  return transcripts.join(" ").trim();
}

type UseAssessmentLiveVoiceArgs = {
  openingTurn: string;
  setError: (message: string | null) => void;
  onVoiceTurn: (args: {
    transcriptText: string;
    durationSeconds: number;
  }) => Promise<{
    aiReplyText: string;
    continueConversation: boolean;
  } | null>;
};

export function useAssessmentLiveVoice({
  openingTurn,
  setError,
  onVoiceTurn,
}: UseAssessmentLiveVoiceArgs) {
  const [voiceState, setVoiceState] = useState<AssessmentVoiceState>("idle");
  const [liveActive, setLiveActive] = useState(false);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const liveActiveRef = useRef(false);
  const awaitingReplyRef = useRef(false);
  const speakingRef = useRef(false);
  const stoppingRef = useRef(false);
  const heardResultRef = useRef(false);
  const listeningStartedAtRef = useRef<number | null>(null);

  function clearRecognition() {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognitionRef.current = null;
  }

  function cancelAiSpeech() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
  }

  function stopRecognition() {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    try {
      stoppingRef.current = true;
      recognition.stop();
    } catch {
      try {
        recognition.abort();
      } catch {
        // Ignore shutdown failures from the browser speech API.
      }
    }
  }

  function pauseLiveConversation() {
    liveActiveRef.current = false;
    setLiveActive(false);
    awaitingReplyRef.current = false;
    speakingRef.current = false;
    stopRecognition();
    cancelAiSpeech();
    setVoiceState("idle");
  }

  async function speakAiReply(text: string, continueConversation: boolean) {
    if (!text.trim()) {
      if (continueConversation && liveActiveRef.current) {
        beginListening();
      } else {
        liveActiveRef.current = false;
        setLiveActive(false);
        setVoiceState("idle");
      }
      return;
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (continueConversation && liveActiveRef.current) {
        beginListening();
      } else {
        liveActiveRef.current = false;
        setLiveActive(false);
        setVoiceState("idle");
      }
      return;
    }

    speakingRef.current = true;
    setVoiceState("speaking");
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
      speakingRef.current = false;

      if (continueConversation && liveActiveRef.current) {
        beginListening();
        return;
      }

      liveActiveRef.current = false;
      setLiveActive(false);
      setVoiceState("idle");
    };
    utterance.onerror = () => {
      speakingRef.current = false;

      if (continueConversation && liveActiveRef.current) {
        beginListening();
        return;
      }

      liveActiveRef.current = false;
      setLiveActive(false);
      setVoiceState("idle");
    };

    window.speechSynthesis.speak(utterance);
  }

  function handleRecognitionError(event: SpeechRecognitionErrorEventLike) {
    clearRecognition();

    if (!liveActiveRef.current) {
      return;
    }

    const code = event.error ?? "unknown";
    if (code === "aborted") {
      return;
    }

    if (code === "no-speech") {
      window.setTimeout(() => {
        if (liveActiveRef.current && !awaitingReplyRef.current && !speakingRef.current) {
          beginListening();
        }
      }, 250);
      return;
    }

    const message =
      code === "not-allowed" || code === "service-not-allowed"
        ? "Microphone access was blocked. Voice is required for this diagnostic conversation."
        : "We couldn't keep the microphone live. Try starting the conversation again.";

    liveActiveRef.current = false;
    setLiveActive(false);
    setVoiceState("error");
    setError(message);
  }

async function handleRecognitionResult(event: SpeechRecognitionEventLike) {
    const transcriptText = getTranscriptFromRecognitionEvent(event);
    heardResultRef.current = transcriptText.length > 0;
    clearRecognition();

    if (!transcriptText) {
      if (liveActiveRef.current) {
        beginListening();
      }
      return;
    }

    awaitingReplyRef.current = true;
    setVoiceState("thinking");

    try {
      const startedAt = listeningStartedAtRef.current ?? event.timeStamp ?? 0;
      const endedAt = event.timeStamp ?? startedAt;
      const durationSeconds = Math.max(
        1,
        Math.round((endedAt - startedAt) / 1000)
      );
      const result = await onVoiceTurn({
        transcriptText,
        durationSeconds,
      });

      awaitingReplyRef.current = false;

      if (!result) {
        liveActiveRef.current = false;
        setLiveActive(false);
        setVoiceState("error");
        return;
      }

      await speakAiReply(result.aiReplyText, result.continueConversation);
    } catch {
      awaitingReplyRef.current = false;
      liveActiveRef.current = false;
      setLiveActive(false);
      setVoiceState("error");
      setError("We couldn't continue the voice conversation. Try again.");
    }
  }

  function beginListening() {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      liveActiveRef.current = false;
      setLiveActive(false);
      setVoiceState("error");
      setError("This browser can't run the live voice diagnostic.");
      return;
    }

    clearRecognition();
    heardResultRef.current = false;
    stoppingRef.current = false;
    listeningStartedAtRef.current = 0;

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onstart = (event?: { timeStamp?: number }) => {
      listeningStartedAtRef.current = event?.timeStamp ?? 0;
      setVoiceState("listening");
    };
    recognition.onresult = (event) => {
      void handleRecognitionResult(event);
    };
    recognition.onerror = (event) => {
      handleRecognitionError(event);
    };
    recognition.onend = () => {
      clearRecognition();

      if (stoppingRef.current) {
        stoppingRef.current = false;
        return;
      }

      if (!liveActiveRef.current || awaitingReplyRef.current || speakingRef.current) {
        return;
      }

      if (!heardResultRef.current) {
        window.setTimeout(() => {
          if (liveActiveRef.current && !awaitingReplyRef.current && !speakingRef.current) {
            beginListening();
          }
        }, 250);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      clearRecognition();
      liveActiveRef.current = false;
      setLiveActive(false);
      setVoiceState("error");
      setError("We couldn't start the microphone. Try again.");
    }
  }

  async function startLiveConversation(options?: {
    speakOpeningTurn?: boolean;
  }) {
    if (!supportsContinuousVoice()) {
      setVoiceState("error");
      setError("This browser can't run the live voice diagnostic.");
      return;
    }

    setError(null);
    liveActiveRef.current = true;
    setLiveActive(true);
    setVoiceState("starting");

    if (options?.speakOpeningTurn) {
      await speakAiReply(openingTurn, true);
      return;
    }

    beginListening();
  }

  useEffect(() => {
    return () => {
      liveActiveRef.current = false;
      awaitingReplyRef.current = false;
      speakingRef.current = false;
      stopRecognition();
      cancelAiSpeech();
      clearRecognition();
    };
  }, []);

  return {
    isSupported: supportsContinuousVoice(),
    liveActive,
    voiceState,
    startLiveConversation,
    pauseLiveConversation,
  };
}
