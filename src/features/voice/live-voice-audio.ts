export type AmbientNoiseLevel = "quiet" | "noisy" | "very_noisy";

export function getPreferredRealtimeAudioConstraints(): MediaTrackConstraints {
  return {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    advanced: [
      { channelCount: 1 } as MediaTrackConstraintSet,
      { noiseSuppression: true } as MediaTrackConstraintSet,
      { autoGainControl: true } as MediaTrackConstraintSet,
      { voiceIsolation: true } as unknown as MediaTrackConstraintSet,
    ],
  };
}

function rmsToNoiseLevel(rms: number): AmbientNoiseLevel {
  if (rms >= 0.07) {
    return "very_noisy";
  }

  if (rms >= 0.035) {
    return "noisy";
  }

  return "quiet";
}

export function createAmbientNoiseMonitor(
  stream: MediaStream,
  onChange: (level: AmbientNoiseLevel) => void
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const AudioContextCtor =
    window.AudioContext ||
    ((window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      null);

  if (!AudioContextCtor) {
    return () => undefined;
  }

  const audioContext = new AudioContextCtor();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.75;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  const samples = new Uint8Array(analyser.fftSize);
  let active = true;
  let currentLevel: AmbientNoiseLevel = "quiet";

  const updateLevel = () => {
    if (!active) {
      return;
    }

    analyser.getByteTimeDomainData(samples);
    let sumSquares = 0;

    for (const sample of samples) {
      const centered = (sample - 128) / 128;
      sumSquares += centered * centered;
    }

    const rms = Math.sqrt(sumSquares / samples.length);
    const nextLevel = rmsToNoiseLevel(rms);

    if (nextLevel !== currentLevel) {
      currentLevel = nextLevel;
      onChange(nextLevel);
    }

    window.setTimeout(updateLevel, 250);
  };

  void audioContext.resume().catch(() => undefined);
  onChange(currentLevel);
  updateLevel();

  return () => {
    active = false;
    source.disconnect();
    analyser.disconnect();
    void audioContext.close().catch(() => undefined);
  };
}
