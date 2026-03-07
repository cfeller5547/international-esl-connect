import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/ui-kit/page-shell";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";

export default async function HelpPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  await trackEvent({
    eventName: "help_viewed",
    route: "/app/more/help",
    userId: user.id,
    properties: {},
  });

  return (
    <PageShell className="px-0 py-0">
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">Help and support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Use text mode whenever voice is unavailable. Homework uploads support PDF, image, and pasted text.</p>
          <p>If parsing is low-confidence, review the extracted questions and keep going with manual edits.</p>
          <p>For support, contact: support@eslinternationalconnect.test</p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
