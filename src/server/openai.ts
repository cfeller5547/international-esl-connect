import OpenAI from "openai";

import { env } from "@/server/env";

declare global {
  var __openai__: OpenAI | undefined;
}

export const openai =
  env.OPENAI_API_KEY
    ? global.__openai__ ??
      new OpenAI({
        apiKey: env.OPENAI_API_KEY,
      })
    : null;

if (process.env.NODE_ENV !== "production" && openai) {
  global.__openai__ = openai;
}
