import { notFound } from "next/navigation";

import { LessonPlayer } from "@/features/learn/lesson-player";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { ContentService } from "@/server/services/content-service";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const user = await getCurrentUser();
  const { lessonId } = await params;

  if (!user) {
    return null;
  }

  const lesson = await ContentService.getItem(lessonId).catch(() => null);
  if (!lesson) {
    notFound();
  }

  await trackEvent({
    eventName: "learn_activity_started",
    route: `/app/learn/lesson/${lessonId}`,
    userId: user.id,
    properties: {
      activity_type: "lesson",
      activity_id: lessonId,
      entry_source: "learn",
    },
  });

  const payload = (lesson.assets[0]?.textPayload ?? {}) as {
    sections?: Array<{ title: string; body: string }>;
    checks?: Array<{ prompt: string; options: string[]; correctIndex: number }>;
  };

  return (
    <LessonPlayer
      lessonId={lesson.id}
      unitTitle={lesson.title}
      sections={payload.sections ?? []}
      checks={payload.checks ?? []}
    />
  );
}
