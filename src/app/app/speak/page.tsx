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
  await trackEvent({
    eventName: "speak_recommendation_viewed",
    route: "/app/speak",
    userId: user.id,
    properties: {
      mode: launchState.viewModel.recommendation.mode,
      scenario_key:
        launchState.viewModel.recommendation.scenarioKey ??
        launchState.viewModel.recommendation.starterKey,
    },
  });

  return (
    <PageShell className="px-0 py-0">
      <SpeakLaunchPanel
        recommendation={launchState.viewModel.recommendation}
        starters={launchState.viewModel.starters}
        guidedScenarios={launchState.viewModel.guidedScenarios}
        plan={launchState.plan}
        voiceConfigured={Boolean(env.OPENAI_API_KEY)}
      />
    </PageShell>
  );
}
