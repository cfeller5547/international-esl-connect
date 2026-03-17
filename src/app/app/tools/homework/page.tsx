import { PageShell } from "@/components/ui-kit/page-shell";
import { HomeworkUploadPanel } from "@/features/homework-help/homework-upload-panel";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { prisma } from "@/server/prisma";

export default async function ToolsHomeworkPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const recentSessions = await prisma.homeworkHelpSession.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      homeworkUpload: true,
    },
  });

  await trackEvent({
    eventName: "homework_help_opened_from_tools",
    route: "/app/tools/homework",
    userId: user.id,
    properties: {},
  });

  return (
    <PageShell className="px-0 py-0">
      <HomeworkUploadPanel
        recentSessions={recentSessions.map((session) => ({
          id: session.id,
          createdAt: session.createdAt.toISOString(),
          status: session.status,
          assignmentTitle:
            ((session.homeworkUpload.parsedPayload as { assignmentTitle?: string })
              ?.assignmentTitle as string | undefined) ?? "Homework session",
        }))}
      />
    </PageShell>
  );
}
