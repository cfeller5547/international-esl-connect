import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/ui-kit/page-shell";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { prisma } from "@/server/prisma";

export default async function ToolsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const [activeHomeworkSession, activeTestPrepPlan] = await Promise.all([
    prisma.homeworkHelpSession
      .findFirst({
        where: {
          userId: user.id,
          status: "active",
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
        },
      })
      .catch((error) => {
        console.error("tools:active homework session lookup failed", error);
        return null;
      }),
    prisma.testPrepPlan
      .findFirst({
        where: {
          userId: user.id,
          status: "active",
        },
        orderBy: { targetDate: "asc" },
        select: {
          id: true,
        },
      })
      .catch((error) => {
        console.error("tools:active test prep plan lookup failed", error);
        return null;
      }),
  ]);

  await trackEvent({
    eventName: "tools_viewed",
    route: "/app/tools",
    userId: user.id,
    properties: {},
  });

  return (
    <PageShell className="px-0 py-0">
      <div className="space-y-4 sm:space-y-6">
        <Card className="surface-glow border-border/70 bg-card/95">
          <CardHeader className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
              Tools
            </p>
            <CardTitle className="text-2xl leading-tight sm:text-3xl">Homework help and test prep, separate from curriculum</CardTitle>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Learn stays focused on your assigned curriculum. Use Tools when you need tactical help with homework or a short sprint for an upcoming test.
            </p>
          </CardHeader>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Link href={activeHomeworkSession ? `/app/tools/homework/session/${activeHomeworkSession.id}` : "/app/tools/homework"}>
            <Card className="h-full border-border/70 bg-card/95 transition hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                  Homework Help
                </p>
                <CardTitle className="text-xl sm:text-2xl">
                  {activeHomeworkSession ? "Resume homework session" : "Start homework help"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                  Upload an assignment, parse questions, and work through them step by step without leaving the app.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/app/tools/test-prep">
            <Card className="h-full border-border/70 bg-card/95 transition hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
                  Test Prep Sprint
                </p>
                <CardTitle className="text-xl sm:text-2xl">
                  {activeTestPrepPlan ? "Continue active prep plan" : "Build a prep sprint"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                  Create a short focused plan around your next test date and run a mini mock when you are ready.
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
