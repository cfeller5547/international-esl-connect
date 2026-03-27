import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { LearnGameService } from "@/server/services/learn-game-service";

const schema = z.object({
  unitSlug: z.string().min(1),
  stageId: z.string().min(1),
  inputMode: z.enum(["voice", "fallback"]).optional(),
  attemptNumber: z.number().int().min(1).max(2),
  answer: z.object({
    selectedOptionId: z.string().optional(),
    assembleAssignments: z
      .array(
        z.object({
          slotId: z.string().min(1),
          optionId: z.string().min(1),
        })
      )
      .optional(),
    matches: z
      .array(
        z.object({
          leftId: z.string().min(1),
          rightId: z.string().min(1),
        })
      )
      .optional(),
    hotspotIds: z.array(z.string().min(1)).optional(),
    stateAssignments: z
      .array(
        z.object({
          stateId: z.string().min(1),
          optionId: z.string().min(1),
        })
      )
      .optional(),
    orderedIds: z.array(z.string().min(1)).optional(),
    priorityAssignments: z
      .array(
        z.object({
          cardId: z.string().min(1),
          laneId: z.string().min(1),
        })
      )
      .optional(),
    pathIds: z.array(z.string().min(1)).optional(),
    audioDataUrl: z.string().optional(),
    audioMimeType: z.string().optional(),
    fallbackOptionId: z.string().optional(),
  }),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const evaluation = await LearnGameService.evaluateAttempt({
      userId: user.id,
      unitSlug: payload.unitSlug,
      stageId: payload.stageId,
      inputMode: payload.inputMode,
      attemptNumber: payload.attemptNumber,
      answer: payload.answer,
    });

    return ok(evaluation);
  } catch (error) {
    return toErrorResponse(error);
  }
}
