import { notFound, redirect } from "next/navigation";

import { CheckpointPlayer } from "@/features/learn/checkpoint-player";
import { LearnActivityShell } from "@/features/learn/learn-activity-shell";
import { LearnGamePlayer } from "@/features/learn/learn-game-player";
import { LearnSpeakingMission } from "@/features/learn/learn-speaking-mission";
import { LessonPlayer } from "@/features/learn/lesson-player";
import { StructuredResponseActivity } from "@/features/learn/structured-response-activity";
import { WorksheetPlayer } from "@/features/learn/worksheet-player";
import { PageShell } from "@/components/ui-kit/page-shell";
import { getCurrentUser } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { ContentService } from "@/server/services/content-service";
import { CurriculumService } from "@/server/services/curriculum-service";
import { LearnGameService } from "@/server/services/learn-game-service";
import { LearnSpeakingService } from "@/server/services/learn-speaking-service";

const COMPLETION_ENDPOINT = "/api/v1/learn/curriculum/activity/complete";

export default async function CurriculumActivityPage({
  params,
}: {
  params: Promise<{ unitSlug: string; activityType: string }>;
}) {
  const user = await getCurrentUser();
  const { unitSlug, activityType } = await params;

  if (!user) {
    return null;
  }

  if (activityType === "drill") {
    redirect(`/app/learn/unit/${unitSlug}/game`);
  }

  if (!["lesson", "practice", "game", "speaking", "writing", "checkpoint"].includes(activityType)) {
    notFound();
  }

  const { curriculum, unit, activity } = await CurriculumService.getUnitActivity(
    user.id,
    unitSlug,
    activityType as "lesson" | "practice" | "game" | "speaking" | "writing" | "checkpoint"
  );

  await trackEvent({
    eventName: "learn_activity_started",
    route: `/app/learn/unit/${unitSlug}/${activityType}`,
    userId: user.id,
    properties: {
      activity_type: activityType,
      unit_slug: unitSlug,
      entry_source: "learn",
    },
  });

  const activityIndex = unit.activities.findIndex((entry) => entry.activityType === activity.activityType);
  const nextUnitActivity = unit.activities[activityIndex + 1] ?? null;
  const nextUnit = curriculum.units.find((entry) => entry.orderIndex === unit.orderIndex + 1) ?? null;

  const upcomingAction = nextUnitActivity
    ? {
        title: nextUnitActivity.title,
        description: nextUnitActivity.description,
        href: nextUnitActivity.status === "completed" ? nextUnitActivity.href : undefined,
        label: "After this step",
      }
    : nextUnit
      ? {
          title: `Start ${nextUnit.title}`,
          description: "Completing this checkpoint unlocks the next unit automatically.",
          label: "Next milestone",
        }
      : null;

  if (activity.activityType === "lesson" || activity.activityType === "practice") {
    const contentId = activity.contentItemId;
    if (!contentId) {
      notFound();
    }

    const content = await ContentService.getItem(contentId).catch(() => null);
    if (!content) {
      notFound();
    }

    if (activity.activityType === "lesson") {
      const payload = (content.assets[0]?.textPayload ?? {}) as {
        sections?: Array<{ title: string; body: string }>;
        checks?: Array<{ prompt: string; options: string[]; correctIndex: number }>;
      };

      return (
        <LearnActivityShell
          curriculumTitle={curriculum.curriculum.title}
          unitTitle={unit.title}
          unitOrder={unit.orderIndex}
          unitSlug={unit.slug}
          canDoStatement={unit.canDoStatement}
          performanceTask={unit.performanceTask}
          activityType="lesson"
          activityTitle={activity.title}
          activityDescription={activity.description}
          activities={unit.activities}
          upcomingAction={upcomingAction}
        >
          <LessonPlayer
            lessonId={content.id}
            unitTitle={unit.title}
            sections={payload.sections ?? []}
            checks={payload.checks ?? []}
            completionRequest={{
              endpoint: COMPLETION_ENDPOINT,
              body: {
                unitSlug,
                activityType: "lesson",
              },
              buttonLabel: "Complete lesson",
              fallbackHref: "/app/learn",
            }}
          />
        </LearnActivityShell>
      );
    }

    const payload = (content.assets[0]?.textPayload ?? {}) as {
      questions?: Array<{ id: string; prompt: string; answer: string }>;
    };

    return (
      <LearnActivityShell
        curriculumTitle={curriculum.curriculum.title}
        unitTitle={unit.title}
        unitOrder={unit.orderIndex}
        unitSlug={unit.slug}
        canDoStatement={unit.canDoStatement}
        performanceTask={unit.performanceTask}
        activityType="practice"
        activityTitle={activity.title}
        activityDescription={activity.description}
        activities={unit.activities}
        upcomingAction={upcomingAction}
      >
        <WorksheetPlayer
          worksheetId={content.id}
          unitTitle={unit.title}
          questions={payload.questions ?? []}
          completionRequest={{
            endpoint: COMPLETION_ENDPOINT,
            body: {
              unitSlug,
              activityType: "practice",
            },
            buttonLabel: "Complete practice",
            fallbackHref: "/app/learn",
          }}
        />
      </LearnActivityShell>
    );
  }

  if (activity.activityType === "game") {
    const gameView = await LearnGameService.getGameView(user.id, unitSlug);

    return (
      <PageShell className="px-0 py-0">
        <LearnGamePlayer
          unitSlug={unitSlug}
          unitTitle={unit.title}
          curriculumTitle={curriculum.curriculum.title}
          unitOrder={unit.orderIndex}
          canDoStatement={unit.canDoStatement}
          activities={unit.activities.map((entry) => ({
            id: entry.id,
            activityType: entry.activityType,
            orderIndex: entry.orderIndex,
            status: entry.status as "locked" | "unlocked" | "completed",
          }))}
          game={gameView.game}
          voiceEnabled={gameView.voiceEnabled}
          progressStatus={gameView.progressStatus as "locked" | "unlocked" | "completed"}
          savedReview={gameView.savedReview}
          completionEndpoint={COMPLETION_ENDPOINT}
          fallbackHref="/app/learn"
          nextHref={nextUnitActivity?.href ?? "/app/learn"}
          nextLabel={nextUnitActivity ? `Continue to ${nextUnitActivity.activityType}` : "Return to Learn"}
        />
      </PageShell>
    );
  }

  if (activity.activityType === "speaking") {
    const missionView = await LearnSpeakingService.getMissionView(user.id, unitSlug);

    return (
      <PageShell className="px-0 py-0">
        <LearnSpeakingMission
          unitSlug={unitSlug}
          unitTitle={unit.title}
          unitOrder={unit.orderIndex}
          canDoStatement={unit.canDoStatement}
          performanceTask={unit.performanceTask}
          mission={missionView.mission}
          plan={missionView.plan}
          voiceEnabled={missionView.voiceEnabled}
          progressStatus={missionView.progressStatus as "locked" | "unlocked" | "completed"}
          initialSession={missionView.session}
          savedReview={missionView.savedReview}
          completionEndpoint={COMPLETION_ENDPOINT}
          fallbackHref="/app/learn"
        />
      </PageShell>
    );
  }

  if (activity.activityType === "writing") {
    return (
      <LearnActivityShell
        curriculumTitle={curriculum.curriculum.title}
        unitTitle={unit.title}
        unitOrder={unit.orderIndex}
        unitSlug={unit.slug}
        canDoStatement={unit.canDoStatement}
        performanceTask={unit.performanceTask}
        activityType="writing"
        activityTitle={activity.title}
        activityDescription={activity.description}
        activities={unit.activities}
        upcomingAction={upcomingAction}
      >
        <StructuredResponseActivity
          endpoint={COMPLETION_ENDPOINT}
          unitSlug={unitSlug}
          unitTitle={unit.title}
          activityType="writing"
          title={activity.title}
          description={String(activity.payload.prompt ?? activity.description)}
          prompts={[String(activity.payload.prompt ?? activity.description)]}
          criteria={
            Array.isArray(activity.payload.criteria)
              ? activity.payload.criteria.map(String)
              : [
                  `Show this can-do goal: ${unit.canDoStatement}`,
                  `Use language from ${unit.title}.`,
                ]
          }
          fallbackHref="/app/learn"
        />
      </LearnActivityShell>
    );
  }

  const questions = Array.isArray(activity.payload.questions)
    ? (activity.payload.questions as Array<{
        prompt: string;
        options: string[];
        correctIndex: number;
      }>)
    : [];

  return (
    <LearnActivityShell
      curriculumTitle={curriculum.curriculum.title}
      unitTitle={unit.title}
      unitOrder={unit.orderIndex}
      unitSlug={unit.slug}
      canDoStatement={unit.canDoStatement}
      performanceTask={unit.performanceTask}
      activityType="checkpoint"
      activityTitle={activity.title}
      activityDescription={activity.description}
      activities={unit.activities}
      upcomingAction={upcomingAction}
    >
      <CheckpointPlayer
        endpoint={COMPLETION_ENDPOINT}
        unitSlug={unitSlug}
        unitTitle={unit.title}
        title={activity.title}
        description={activity.description}
        questions={questions}
        fallbackHref="/app/learn"
      />
    </LearnActivityShell>
  );
}
