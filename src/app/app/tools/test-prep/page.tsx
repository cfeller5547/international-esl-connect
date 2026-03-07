import { PageShell } from "@/components/ui-kit/page-shell";
import { TestPrepPanel } from "@/features/learn/test-prep-panel";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { prisma } from "@/server/prisma";

export default async function ToolsTestPrepPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const activePlan = await prisma.testPrepPlan.findFirst({
    where: {
      userId: user.id,
      status: "active",
    },
    orderBy: { createdAt: "desc" },
  });

  await trackEvent({
    eventName: "test_prep_opened_from_tools",
    route: "/app/tools/test-prep",
    userId: user.id,
    properties: {},
  });

  return (
    <PageShell className="px-0 py-0">
      <TestPrepPanel
        activePlan={
          activePlan
            ? {
                id: activePlan.id,
                targetDate: activePlan.targetDate.toISOString(),
                planPayload: activePlan.planPayload as {
                  days?: Array<{
                    dayIndex: number;
                    topic: string;
                    focusSkills: string[];
                    scheduledDate: string;
                  }>;
                },
              }
            : null
        }
      />
    </PageShell>
  );
}
