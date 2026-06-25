import { PageShell } from "@/components/ui-kit/page-shell";
import { SpeakLaunchPanel } from "@/features/speak/speak-launch-panel";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { env } from "@/server/env";
import { SpeakService } from "@/server/services/speak-service";

export default async function SpeakPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const launchState = await SpeakService.getLaunchState(user.id);

  await trackEvent({
    eventName: "speak_landing_viewed",
    route: "/app/speak",
    userId: user.id,
    properties: {},
  });

  return (
    <PageShell className="px-0 py-0">
      <SpeakLaunchPanel
        viewModel={launchState.viewModel}
        voiceConfigured={Boolean(env.OPENAI_API_KEY)}
        plan={launchState.plan}
      />
    </PageShell>
  );
}
