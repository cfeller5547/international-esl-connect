import { GUIDED_SCENARIOS, SPEAK_STARTERS } from "@/lib/constants";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SpeakLaunchPanel } from "@/features/speak/speak-launch-panel";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";

export default async function SpeakPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  await trackEvent({
    eventName: "speak_landing_viewed",
    route: "/app/speak",
    userId: user.id,
    properties: {},
  });

  return (
    <PageShell className="px-0 py-0">
      <SpeakLaunchPanel starters={[...SPEAK_STARTERS]} guidedScenarios={[...GUIDED_SCENARIOS]} />
    </PageShell>
  );
}

