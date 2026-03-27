"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecordedAudio = {
  audioDataUrl: string;
  audioMimeType: string;
  durationSeconds: number;
};

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read audio blob."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read audio blob."));
    reader.readAsDataURL(blob);
  });
}

export function useVoiceRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);

  const [isSupported, setIsSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("Voice recording is not supported in this browser.");
      return;
    }

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
      });

      chunksRef.current = [];
      recorderRef.current = recorder;
      streamRef.current = stream;
      startedAtRef.current = Date.now();

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.start();
      setRecording(true);
    } catch (recordingError) {
      const message =
        recordingError instanceof Error
          ? recordingError.message
          : "Microphone access was not available.";
      setError(message);
      setRecording(false);
    }
  }, [isSupported]);

  const stopRecording = useCallback(async (): Promise<RecordedAudio | null> => {
    const recorder = recorderRef.current;
    if (!recorder) {
      return null;
    }

    return new Promise((resolve, reject) => {
      recorder.addEventListener(
        "stop",
        async () => {
          try {
            const mimeType = recorder.mimeType || "audio/webm";
            const blob = new Blob(chunksRef.current, {
              type: mimeType,
            });
            const audioDataUrl = await blobToDataUrl(blob);
            const durationSeconds = Math.max(
              1,
              Math.round((Date.now() - (startedAtRef.current ?? Date.now())) / 1000)
            );

            streamRef.current?.getTracks().forEach((track) => track.stop());
            recorderRef.current = null;
            streamRef.current = null;
            chunksRef.current = [];
            startedAtRef.current = null;
            setRecording(false);

            resolve({
              audioDataUrl,
              audioMimeType: mimeType,
              durationSeconds,
            });
          } catch (stopError) {
            setRecording(false);
            reject(stopError);
          }
        },
        { once: true }
      );

      recorder.stop();
    });
  }, []);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isSupported,
    recording,
    error,
    resetError,
    startRecording,
    stopRecording,
  };
}
