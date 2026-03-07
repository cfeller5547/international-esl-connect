import { z } from "zod";

import { AppError } from "@/server/errors";

export async function parseJson<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  const payload = await request.json().catch(() => {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON payload.", 400);
  });

  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", "Request validation failed.", 400, {
      issues: result.error.flatten(),
    });
  }

  return result.data;
}

export function ok(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

