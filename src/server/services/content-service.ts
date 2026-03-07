import { bootstrapDatabase } from "@/server/bootstrap-data";
import { AppError } from "@/server/errors";
import { prisma } from "@/server/prisma";

type ContentFilters = {
  contentType?: string;
  targetLanguage?: string;
  topic?: string;
  limit?: number;
};

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function sourceRank(sourceType: string) {
  return sourceType === "teacher_provided" ? 0 : 1;
}

export const ContentService = {
  async ensureSeeded() {
    await bootstrapDatabase();
  },

  async getItems(filters: ContentFilters = {}) {
    await this.ensureSeeded();

    const items = await prisma.contentItem.findMany({
      where: {
        status: "published",
        ...(filters.contentType ? { contentType: filters.contentType } : {}),
        ...(filters.targetLanguage ? { targetLanguage: filters.targetLanguage } : {}),
      },
      include: {
        assets: true,
      },
      orderBy: [{ publishedAt: "desc" }],
    });

    const filtered = items.filter((item) => {
      if (!filters.topic) return true;
      return asStringArray(item.topicTags).some((topic) =>
        topic.toLowerCase().includes(filters.topic!.toLowerCase())
      );
    });

    return filtered.slice(0, filters.limit ?? filtered.length);
  },

  async getItem(contentId: string) {
    await this.ensureSeeded();

    const item = await prisma.contentItem.findUnique({
      where: { id: contentId },
      include: { assets: true },
    });

    if (!item) {
      throw new AppError("NOT_FOUND", "Content item not found.", 404);
    }

    return item;
  },

  async getPreferredContent({
    targetLanguage,
    topic,
    skill,
    contentType = "lesson",
  }: {
    targetLanguage: string;
    topic?: string | null;
    skill?: string | null;
    contentType?: string;
  }) {
    const items = await this.getItems({ contentType, targetLanguage });

    const scored = items
      .map((item) => {
        const skillTags = asStringArray(item.skillTags);
        const topicTags = asStringArray(item.topicTags);
        const skillMatch = skill ? skillTags.includes(skill) : true;
        const topicMatch = topic
          ? topicTags.some((itemTopic) =>
              itemTopic.toLowerCase().includes(topic.toLowerCase())
            )
          : false;

        return {
          item,
          score: (topicMatch ? 4 : 0) + (skillMatch ? 2 : 0) - sourceRank(item.sourceType),
          topicMatch,
          skillMatch,
        };
      })
      .filter((candidate) => candidate.skillMatch || candidate.topicMatch)
      .sort((a, b) => b.score - a.score);

    return scored[0]?.item ?? null;
  },

  async importItems(
    sourceType: "teacher_provided" | "placeholder",
    items: Array<{
      contentType: "lesson" | "worksheet" | "video";
      title: string;
      description?: string;
      targetLanguage: "english" | "spanish" | "chinese";
      skillTags: string[];
      topicTags: string[];
      assets: Array<{
        assetType: "video" | "pdf" | "image" | "text" | "external_url";
        assetUrl?: string;
        textPayload?: unknown;
        metadataPayload?: unknown;
      }>;
    }>
  ) {
    const created = [];

    for (const item of items) {
      created.push(
        await prisma.contentItem.create({
          data: {
            sourceType,
            contentType: item.contentType,
            title: item.title,
            description: item.description,
            targetLanguage: item.targetLanguage,
            skillTags: item.skillTags,
            topicTags: item.topicTags,
            status: "published",
            publishedAt: new Date(),
            assets: {
              create: item.assets.map((asset) => ({
                assetType: asset.assetType,
                assetUrl: asset.assetUrl,
                textPayload: asset.textPayload
                  ? (asset.textPayload as never)
                  : undefined,
                metadataPayload: (asset.metadataPayload ?? {}) as never,
              })),
            },
          },
        })
      );
    }

    return created;
  },
};
