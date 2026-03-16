import { AppError } from "@/server/errors";

type RealtimeClientSecretPayload = {
  value?: unknown;
  expires_at?: unknown;
  session?: unknown;
};

export function serializeRealtimeClientSecret(
  realtimeSession: RealtimeClientSecretPayload,
  fallbackModel: string
) {
  if (
    typeof realtimeSession.value !== "string" ||
    realtimeSession.value.length === 0 ||
    typeof realtimeSession.expires_at !== "number"
  ) {
    throw new AppError(
      "AI_SERVICE_UNAVAILABLE",
      "Realtime voice setup failed. Please try again.",
      502
    );
  }

  const session =
    realtimeSession.session && typeof realtimeSession.session === "object"
      ? realtimeSession.session
      : null;
  const model =
    session && "model" in session && typeof session.model === "string" && session.model.length > 0
      ? session.model
      : fallbackModel;

  return {
    clientSecret: realtimeSession.value,
    expiresAt: realtimeSession.expires_at,
    model,
  };
}
