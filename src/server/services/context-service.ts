import { prisma } from "@/server/prisma";

import { trackEvent } from "../analytics";

function extractTopicsFromText(text: string) {
  return text
    .split(/\r?\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export const ContextService = {
  async saveManualTopics({
    userId,
    topics,
    activeFrom,
    activeTo,
  }: {
    userId: string;
    topics: string[];
    activeFrom: string;
    activeTo: string;
  }) {
    const syllabusProfile = await prisma.syllabusProfile.create({
      data: {
        userId,
        sourceType: "manual_topics",
        topicsPayload: topics,
        activeFrom: new Date(activeFrom),
        activeTo: new Date(activeTo),
      },
    });

    await trackEvent({
      eventName: "class_context_submitted",
      route: "/app/home",
      userId,
      properties: {
        source_type: "manual_topics",
      },
    });

    return syllabusProfile;
  },

  async saveSyllabusUpload({
    userId,
    uploadId,
    text,
  }: {
    userId: string;
    uploadId: string;
    text: string;
  }) {
    const topics = extractTopicsFromText(text);

    const syllabusProfile = await prisma.syllabusProfile.create({
      data: {
        userId,
        sourceType: "upload",
        sourceUploadId: uploadId,
        topicsPayload: topics,
        activeFrom: new Date(),
        activeTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      },
    });

    await trackEvent({
      eventName: "class_context_submitted",
      route: "/app/home",
      userId,
      properties: {
        source_type: "upload",
      },
    });

    return syllabusProfile;
  },

  async saveClassProfile({
    userId,
    schoolName,
    className,
    instructorName,
    periodLabel,
    courseLevel,
  }: {
    userId: string;
    schoolName?: string;
    className?: string;
    instructorName?: string;
    periodLabel?: string;
    courseLevel?: string;
  }) {
    const profile = await prisma.classContextProfile.upsert({
      where: { userId },
      update: {
        schoolName,
        className,
        instructorName,
        periodLabel,
        courseLevel,
      },
      create: {
        userId,
        schoolName,
        className,
        instructorName,
        periodLabel,
        courseLevel,
      },
    });

    await trackEvent({
      eventName: "class_context_submitted",
      route: "/app/home",
      userId,
      properties: {
        source_type: "class_profile",
      },
    });

    return profile;
  },

  async getActiveTopics(userId: string) {
    const now = new Date();

    const profiles = await prisma.syllabusProfile.findMany({
      where: {
        userId,
        activeTo: { gte: now },
      },
      orderBy: { updatedAt: "desc" },
    });

    return profiles.flatMap((profile) =>
      Array.isArray(profile.topicsPayload) ? profile.topicsPayload.map(String) : []
    );
  },
};
