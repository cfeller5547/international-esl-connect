import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/ui-kit/page-shell";
import { FREE_TIER_LIMITS } from "@/lib/constants";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { UsageService } from "@/server/services/usage-service";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const { returnTo } = await searchParams;
  const usage = await UsageService.getUsageSnapshot(user.id);

  await trackEvent({
    eventName: "billing_viewed",
    route: "/app/more/billing",
    userId: user.id,
    properties: {},
  });

  async function upgrade() {
    "use server";

    const user = await getCurrentUser();
    if (!user) return;

    await trackEvent({
      eventName: "upgrade_started",
      route: "/app/more/billing",
      userId: user.id,
      properties: {
        plan: "pro",
      },
    });

    await UsageService.upgradeToPro(user.id);

    await trackEvent({
      eventName: "upgrade_completed",
      route: "/app/more/billing",
      userId: user.id,
      properties: {
        plan: "pro",
        billing_provider: "manual_demo",
      },
    });

    if (returnTo) {
      await trackEvent({
        eventName: "upgrade_return_to_task_succeeded",
        route: returnTo,
        userId: user.id,
        properties: {
          return_to: returnTo,
          task_type: "upgrade_resume",
        },
      });
      redirect(returnTo);
    }
  }

  return (
    <PageShell className="px-0 py-0">
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-2xl">
            {usage.plan === "pro" ? "Pro plan active" : "Upgrade to Pro"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-muted/30 px-5 py-4">
              <p className="font-semibold text-foreground">Current plan</p>
              <p className="mt-2 text-sm text-muted-foreground">{usage.plan}</p>
            </div>
            <div className="rounded-3xl bg-muted/30 px-5 py-4">
              <p className="font-semibold text-foreground">Free limits</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>{FREE_TIER_LIMITS.speakTextTurnsPerDay} text turns/day</li>
                <li>{FREE_TIER_LIMITS.homeworkUploadsPerDay} homework uploads/day</li>
                <li>{FREE_TIER_LIMITS.reassessmentsPer30Days} reassessment/30 days</li>
              </ul>
            </div>
          </div>
          {usage.plan === "free" ? (
            <form action={upgrade}>
              <Button type="submit" variant="accent" size="lg" className="w-full">
                Upgrade
              </Button>
            </form>
          ) : (
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link href={returnTo ?? "/app/home"}>Continue</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

