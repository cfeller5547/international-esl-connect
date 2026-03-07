/** @vitest-environment node */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/prisma";
import { bootstrapDatabase } from "@/server/bootstrap-data";
import { ContentService } from "@/server/services/content-service";
import { RecommendationService } from "@/server/services/recommendation-service";
import { UsageService } from "@/server/services/usage-service";

describe("content precedence and recommendation rules", () => {
  beforeAll(async () => {
    await bootstrapDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("prefers teacher-provided content over placeholder for the same topic", async () => {
    const topic = `test-topic-${crypto.randomUUID()}`;

    await prisma.contentItem.create({
      data: {
        sourceType: "placeholder",
        contentType: "lesson",
        title: "Placeholder Topic Practice",
        targetLanguage: "spanish",
        skillTags: ["grammar"] as never,
        topicTags: [topic] as never,
        status: "published",
        publishedAt: new Date(),
      },
    });

    const expectedTitle = "Teacher Topic Practice";
    await prisma.contentItem.create({
      data: {
        sourceType: "teacher_provided",
        contentType: "lesson",
        title: expectedTitle,
        targetLanguage: "spanish",
        skillTags: ["grammar"] as never,
        topicTags: [topic] as never,
        status: "published",
        publishedAt: new Date(),
      },
    });

    const item = await ContentService.getPreferredContent({
      targetLanguage: "spanish",
      skill: "grammar",
      topic,
    });

    expect(item?.sourceType).toBe("teacher_provided");
    expect(item?.title).toBe(expectedTitle);
  });

  it("returns complete_full_diagnostic when the user has not finished it", async () => {
    const email = `recommendation-${crypto.randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "spanish",
        schoolLevel: "high_school",
      },
    });
    await UsageService.getOrCreateSubscription(user.id);

    const recommendation = await RecommendationService.getRecommendation(user.id, "home");
    expect(recommendation.reasonCode).toBe("complete_full_diagnostic");
  });

  it("prefers resume_homework_help over later recommendation rules", async () => {
    const email = `homework-priority-${crypto.randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "spanish",
        schoolLevel: "high_school",
        fullDiagnosticCompletedAt: new Date(),
      },
    });
    await UsageService.getOrCreateSubscription(user.id);

    const upload = await prisma.homeworkUpload.create({
      data: {
        userId: user.id,
        fileUrl: "inline://test.txt",
        inputType: "text",
        status: "parsed",
        parsedPayload: {
          rawText: "1. Translate the sentence.",
          questions: [{ index: 1, promptText: "Translate the sentence.", questionType: "translation" }],
        } as never,
        parseConfidence: 0.9,
      },
    });

    await prisma.homeworkHelpSession.create({
      data: {
        userId: user.id,
        homeworkUploadId: upload.id,
        status: "active",
      },
    });

    const recommendation = await RecommendationService.getRecommendation(user.id, "home");
    expect(recommendation.reasonCode).toBe("resume_homework_help");
  });

  it("falls back to the next curriculum activity when no tool is more urgent", async () => {
    const email = `curriculum-recommendation-${crypto.randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: "hashed",
        ageBand: "age_16_18",
        nativeLanguage: "english",
        targetLanguage: "english",
        schoolLevel: "high_school",
        currentLevel: "very_basic",
        fullDiagnosticCompletedAt: new Date(),
      },
    });
    await UsageService.getOrCreateSubscription(user.id);

    const recommendation = await RecommendationService.getRecommendation(user.id, "home");
    expect(recommendation.reasonCode).toBe("continue_curriculum");
    expect(recommendation.targetUrl).toContain("/app/learn/unit/");
  });
});
