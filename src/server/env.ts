import { z } from "zod";

function readEnvValue(value: string | undefined) {
  return typeof value === "string" ? value.trim() : value;
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16).default("development-session-secret-123"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  OPENAI_API_KEY: z.string().min(20).optional(),
  OPENAI_TEXT_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  OPENAI_REALTIME_MODEL: z.string().min(1).default("gpt-realtime"),
  OPENAI_TRANSCRIPTION_MODEL: z.string().min(1).default("gpt-4o-mini-transcribe"),
  OPENAI_TTS_MODEL: z.string().min(1).default("gpt-4o-mini-tts"),
  OPENAI_TTS_VOICE: z.string().min(1).default("alloy"),
  OPENAI_REALTIME_VOICE: z.string().min(1).default("marin"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: readEnvValue(process.env.DATABASE_URL),
  SESSION_SECRET: readEnvValue(process.env.SESSION_SECRET),
  NEXT_PUBLIC_APP_URL: readEnvValue(process.env.NEXT_PUBLIC_APP_URL),
  OPENAI_API_KEY: readEnvValue(process.env.OPENAI_API_KEY),
  OPENAI_TEXT_MODEL: readEnvValue(process.env.OPENAI_TEXT_MODEL),
  OPENAI_REALTIME_MODEL: readEnvValue(process.env.OPENAI_REALTIME_MODEL),
  OPENAI_TRANSCRIPTION_MODEL: readEnvValue(process.env.OPENAI_TRANSCRIPTION_MODEL),
  OPENAI_TTS_MODEL: readEnvValue(process.env.OPENAI_TTS_MODEL),
  OPENAI_TTS_VOICE: readEnvValue(process.env.OPENAI_TTS_VOICE),
  OPENAI_REALTIME_VOICE: readEnvValue(process.env.OPENAI_REALTIME_VOICE),
});

if (!parsed.success) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
}

export const env = parsed.success
  ? parsed.data
  : {
      DATABASE_URL:
        readEnvValue(process.env.DATABASE_URL) ??
        "postgresql://postgres:postgres@localhost:5434/esl_connect",
      SESSION_SECRET:
        readEnvValue(process.env.SESSION_SECRET) ?? "development-session-secret-123",
      NEXT_PUBLIC_APP_URL:
        readEnvValue(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000",
      OPENAI_API_KEY: readEnvValue(process.env.OPENAI_API_KEY),
      OPENAI_TEXT_MODEL: readEnvValue(process.env.OPENAI_TEXT_MODEL) ?? "gpt-4.1-mini",
      OPENAI_REALTIME_MODEL:
        readEnvValue(process.env.OPENAI_REALTIME_MODEL) ?? "gpt-realtime",
      OPENAI_TRANSCRIPTION_MODEL:
        readEnvValue(process.env.OPENAI_TRANSCRIPTION_MODEL) ?? "gpt-4o-mini-transcribe",
      OPENAI_TTS_MODEL: readEnvValue(process.env.OPENAI_TTS_MODEL) ?? "gpt-4o-mini-tts",
      OPENAI_TTS_VOICE: readEnvValue(process.env.OPENAI_TTS_VOICE) ?? "alloy",
      OPENAI_REALTIME_VOICE: readEnvValue(process.env.OPENAI_REALTIME_VOICE) ?? "marin",
    };
