import { ContentType, LanguageCode } from "@/generated/prisma/enums";
import { ok } from "@/server/http";
import { ContentService } from "@/server/services/content-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contentType = searchParams.get("contentType");
  const targetLanguage = searchParams.get("targetLanguage");
  const topic = searchParams.get("topic") ?? undefined;
  const limit = searchParams.get("limit");

  const items = await ContentService.getItems({
    contentType: (contentType as ContentType | null) ?? undefined,
    targetLanguage: (targetLanguage as LanguageCode | null) ?? undefined,
    topic,
    limit: limit ? Number(limit) : undefined,
  });

  return ok({
    items: items.map((item) => ({
      contentId: item.id,
      title: item.title,
      contentType: item.contentType,
      sourceType: item.sourceType,
      targetLanguage: item.targetLanguage,
      topicTags: item.topicTags,
    })),
  });
}
