import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { env } from "@/server/env";
import { AppError, toErrorResponse } from "@/server/errors";
import { parseJson } from "@/server/http";
import { openai } from "@/server/openai";

const schema = z.object({
  text: z.string().min(1).max(220),
});

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

const GAME_SPEECH_INSTRUCTIONS =
  "Speak this line in a warm, natural, human voice for an English learner. Pronounce every word clearly, use gentle conversational pacing, pause naturally at punctuation, and avoid sounding robotic, rushed, or announcer-like.";

function preferredGameSpeechVoice() {
  const configuredVoice = process.env.OPENAI_TTS_VOICE?.trim();
  return configuredVoice || env.OPENAI_REALTIME_VOICE || "marin";
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const text = normalizeText(payload.text);

    if (!text) {
      throw new AppError("VALIDATION_ERROR", "Speech text is required.", 400);
    }

    if (!openai) {
      return new Response(null, {
        status: 204,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    }

    const audio = await openai.audio.speech.create({
      model: env.OPENAI_TTS_MODEL,
      voice: preferredGameSpeechVoice(),
      input: text,
      instructions: GAME_SPEECH_INSTRUCTIONS,
      response_format: "mp3",
      speed: 0.94,
    });

    return new Response(await audio.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
