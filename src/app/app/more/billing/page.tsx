import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/ui-kit/page-shell";
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

  return (
    <PageShell className="px-0 py-0">
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-2xl">Pro access enabled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-muted/30 px-5 py-4">
              <p className="font-semibold text-foreground">Current plan</p>
              <p className="mt-2 text-sm text-muted-foreground">{usage.plan}</p>
            </div>
            <div className="rounded-3xl bg-muted/30 px-5 py-4">
              <p className="font-semibold text-foreground">Temporary access mode</p>
              <p className="mt-2 text-sm text-muted-foreground">
                All accounts are currently provisioned on Pro by default while billing is held
                in preview mode.
              </p>
            </div>
          </div>
          <div className="rounded-3xl bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
            Upgrade controls stay wired for later, but learners should not hit plan gates right
            now.
          </div>
          <Button asChild variant="secondary" size="lg" className="w-full">
            <Link href={returnTo ?? "/app/home"}>Continue</Link>
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
