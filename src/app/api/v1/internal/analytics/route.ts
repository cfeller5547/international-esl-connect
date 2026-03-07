import { z } from "zod";

import { toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { trackEvent } from "@/server/analytics";

const schema = z.object({
  eventName: z.string().min(1),
  route: z.string().min(1),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJson(request, schema);
    await trackEvent(payload);
    return ok({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
