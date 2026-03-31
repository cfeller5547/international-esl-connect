import { z } from "zod";

import {
  getAdminPreviewLevel,
  getCurrentUser,
  isAdminUserId,
  setAdminPreviewLevelCookie,
} from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { CURRICULUM_LEVELS } from "@/server/curriculum-blueprint";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";

const previewLevelSchema = z.object({
  level: z.union([z.enum(CURRICULUM_LEVELS), z.null()]),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    if (!(await isAdminUserId(user.id))) {
      throw new AppError("FORBIDDEN", "Admin access required.", 403);
    }

    const previousPreviewLevel = await getAdminPreviewLevel(user.id);
    const { level } = await parseJson(request, previewLevelSchema);

    await setAdminPreviewLevelCookie(level);

    await trackEvent({
      eventName: "admin_preview_level_changed",
      route: "/app",
      userId: user.id,
      properties: {
        canonical_level: user.currentLevel,
        previous_preview_level: previousPreviewLevel,
        preview_level: level,
      },
    });

    return ok({
      previewLevel: level,
      canonicalLevel: user.currentLevel,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
