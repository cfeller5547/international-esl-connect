import { z } from "zod";

import { toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { trackEvent } from "@/server/analytics";
import { ContentService } from "@/server/services/content-service";

const schema = z.object({
  sourceType: z.enum(["teacher_provided", "placeholder"]),
  items: z.array(
    z.object({
      contentType: z.enum(["lesson", "worksheet", "video"]),
      title: z.string(),
      description: z.string().optional(),
      targetLanguage: z.enum(["english", "spanish", "chinese"]),
      skillTags: z.array(z.string()),
      topicTags: z.array(z.string()),
      assets: z.array(
        z.object({
          assetType: z.enum(["video", "pdf", "image", "text", "external_url"]),
          assetUrl: z.string().optional(),
          textPayload: z.unknown().optional(),
          metadataPayload: z.unknown().optional(),
        })
      ),
    })
  ),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJson(request, schema);
    const items = await ContentService.importItems(payload.sourceType, payload.items);

    await trackEvent({
      eventName: "content_import_completed",
      route: "/api/v1/internal/content/import",
      properties: {
        source_type: payload.sourceType,
        item_count: items.length,
      },
    });

    return ok({
      importedCount: items.length,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
