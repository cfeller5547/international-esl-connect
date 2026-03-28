type RealtimeTurnDetectionMode = "semantic_vad" | "server_vad";

export const REALTIME_TURN_DETECTION_MODE: RealtimeTurnDetectionMode = "semantic_vad";

export function createRealtimeTurnDetectionConfig() {
  if (REALTIME_TURN_DETECTION_MODE === "semantic_vad") {
    return {
      type: "semantic_vad" as const,
      eagerness: "low" as const,
      create_response: true,
      interrupt_response: false,
    };
  }

  return {
    type: "server_vad" as const,
    create_response: true,
    interrupt_response: false,
    idle_timeout_ms: 6000,
    prefix_padding_ms: 300,
    silence_duration_ms: 700,
  };
}
