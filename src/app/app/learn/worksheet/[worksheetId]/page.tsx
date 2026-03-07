import { notFound } from "next/navigation";

import { WorksheetPlayer } from "@/features/learn/worksheet-player";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { ContentService } from "@/server/services/content-service";

export default async function WorksheetPage({
  params,
}: {
  params: Promise<{ worksheetId: string }>;
}) {
  const user = await getCurrentUser();
  const { worksheetId } = await params;

  if (!user) {
    return null;
  }

  const worksheet = await ContentService.getItem(worksheetId).catch(() => null);
  if (!worksheet) {
    notFound();
  }

  await trackEvent({
    eventName: "learn_activity_started",
    route: `/app/learn/worksheet/${worksheetId}`,
    userId: user.id,
    properties: {
      activity_type: "worksheet",
      activity_id: worksheetId,
      entry_source: "learn",
    },
  });

  const payload = (worksheet.assets[0]?.textPayload ?? {}) as {
    questions?: Array<{ id: string; prompt: string; answer: string }>;
  };

  return (
    <WorksheetPlayer
      worksheetId={worksheet.id}
      unitTitle={worksheet.title}
      questions={payload.questions ?? []}
    />
  );
}
