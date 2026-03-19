"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trackClientEvent } from "@/lib/client-analytics";
import type { SpeakLaunchStarter, SpeakMissionPlan } from "@/features/speak/speak-view-model";

type SpeakLaunchPanelProps = {
  recommendation: SpeakMissionPlan;
  starters: SpeakLaunchStarter[];
  guidedScenarios: Array<{ key: string; title: string; description: string }>;
  voiceConfigured: boolean;
  plan: "free" | "pro";
};

type StartPayload = {
  mode: "free_speech" | "guided";
  interactionMode: "text" | "voice";
  starterKey: string | null;
  scenarioKey: string | null;
};

export function SpeakLaunchPanel({
  recommendation,
  starters,
  guidedScenarios,
  voiceConfigured,
  plan,
}: SpeakLaunchPanelProps) {
  const router = useRouter();
  const recommendedInteractionMode =
    recommendation.recommendedInteractionMode === "voice" && voiceConfigured && plan === "pro"
      ? "voice"
      : "text";

  const [selectedMode, setSelectedMode] = useState<"free_speech" | "guided">(
    recommendation.mode
  );
  const [interactionMode, setInteractionMode] = useState<"text" | "voice">(
    recommendedInteractionMode
  );
  const [starterKey, setStarterKey] = useState(
    recommendation.starterKey ?? starters[0]?.key ?? "today"
  );
  const [scenarioKey, setScenarioKey] = useState(
    recommendation.scenarioKey ?? guidedScenarios[0]?.key ?? "class_discussion"
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStarter =
    starters.find((starter) => starter.key === starterKey) ?? starters[0] ?? null;
  const selectedScenario =
    guidedScenarios.find((scenario) => scenario.key === scenarioKey) ?? guidedScenarios[0] ?? null;

  async function handleStart(payload: StartPayload, source: "recommended" | "manual") {
    setPending(true);
    setError(null);

    if (source === "recommended") {
      trackClientEvent({
        eventName: "speak_recommendation_started",
        route: "/app/speak",
        properties: {
          mode: payload.mode,
          scenario_key: payload.scenarioKey ?? payload.starterKey,
        },
      });
    }

    const response = await fetch("/api/v1/speak/session/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responsePayload = (await response.json()) as
      | { error?: { code?: string; message?: string } }
      | { sessionId?: string };

    if (!response.ok) {
      const maybeError = "error" in responsePayload ? responsePayload.error : undefined;

      if (maybeError?.code === "VOICE_MODE_UPGRADE_REQUIRED") {
        setInteractionMode("text");
        setError("Voice is available on Pro. You can keep going with text on this device.");
      } else {
        setError(maybeError?.message ?? "Unable to start session.");
      }

      setPending(false);
      return;
    }

    router.push(`/app/speak/session/${(responsePayload as { sessionId: string }).sessionId}`);
  }

  function renderInteractionModeControl() {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Interaction mode</Label>
        <Select
          value={interactionMode}
          onValueChange={(value: "text" | "voice") => setInteractionMode(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text-first</SelectItem>
            <SelectItem value="voice" disabled={!voiceConfigured}>
              Voice {!voiceConfigured ? "(Unavailable)" : plan === "pro" ? "(Pro)" : "(Pro only)"}
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {interactionMode === "voice" && plan !== "pro"
            ? "Voice is on Pro. Text works now."
            : interactionMode === "voice"
              ? "Live voice, no send buttons."
              : "Text-first, same coaching flow."}
        </p>
      </div>
    );
  }

  function renderModeSwitch() {
    return (
      <div className="inline-flex w-full flex-col rounded-[1rem] border border-border/70 bg-card/80 p-1.5 shadow-sm sm:w-auto sm:flex-row">
        {[
          { key: "free_speech" as const, title: "Free speech" },
          { key: "guided" as const, title: "Guided scenario" },
        ].map((mode) => {
          const isSelected = selectedMode === mode.key;

          return (
            <button
              key={mode.key}
              type="button"
              onClick={() => setSelectedMode(mode.key)}
              className={`rounded-[0.8rem] px-4 py-3 text-left transition sm:min-w-[180px] ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground hover:bg-muted/40"
              }`}
            >
              <span className="font-semibold">{mode.title}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderFooter(content: {
    hint: string;
    buttonLabel: string;
    onStart: () => void;
  }) {
    return (
      <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">{content.hint}</p>
        <div className="w-full sm:w-auto">
          {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
          <Button
            size="lg"
            className="w-full sm:min-w-[220px]"
            disabled={pending}
            onClick={content.onStart}
          >
            {interactionMode === "voice" ? <Mic className="size-4" /> : null}
            {pending ? "Starting..." : content.buttonLabel}
          </Button>
        </div>
      </div>
    );
  }

  function renderFreeSpeechMode() {
    return (
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="space-y-6 p-6 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2 lg:max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Free speech
              </h2>
              <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
                Pick one topic and start talking naturally.
              </p>
            </div>
            <div className="w-full lg:max-w-[280px]">{renderInteractionModeControl()}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {starters.map((starter) => {
              const isSelected = starter.key === starterKey;

              return (
                <button
                  key={starter.key}
                  type="button"
                  disabled={pending}
                  onClick={() => setStarterKey(starter.key)}
                  className={`rounded-[1rem] border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-primary bg-primary/8"
                      : "border-border/70 bg-card hover:bg-muted/20"
                  } ${pending ? "opacity-70" : ""}`}
                >
                  <p className="font-semibold text-foreground">{starter.label}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{starter.prompt}</p>
                </button>
              );
            })}
          </div>

          {renderFooter({
            hint:
              selectedStarter?.hint ??
              recommendation.mission.contextHint ??
              "Start from class or daily life.",
            buttonLabel: "Start free speech",
            onStart: () =>
              selectedStarter
                ? void handleStart(
                    {
                      mode: "free_speech",
                      interactionMode,
                      starterKey: selectedStarter.key,
                      scenarioKey: null,
                    },
                    selectedStarter.key === recommendation.starterKey ? "recommended" : "manual"
                  )
                : undefined,
          })}
        </CardContent>
      </Card>
    );
  }

  function renderGuidedMode() {
    return (
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="space-y-6 p-6 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2 lg:max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Guided scenario
              </h2>
              <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
                Choose one structured role-play.
              </p>
            </div>
            <div className="w-full lg:max-w-[280px]">{renderInteractionModeControl()}</div>
          </div>

          <div className="grid gap-3">
            {guidedScenarios.map((scenario) => (
              <button
                key={scenario.key}
                type="button"
                onClick={() => setScenarioKey(scenario.key)}
                className={`rounded-[1rem] border px-4 py-4 text-left transition ${
                  scenarioKey === scenario.key
                    ? "border-primary bg-primary/8"
                    : "border-border/70 bg-card hover:bg-muted/20"
                }`}
              >
                <p className="font-semibold text-foreground">{scenario.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{scenario.description}</p>
              </button>
            ))}
          </div>

          {renderFooter({
            hint: "You’ll get a short mission brief before the conversation starts.",
            buttonLabel: "Start guided scenario",
            onStart: () =>
              selectedScenario
                ? void handleStart(
                    {
                      mode: "guided",
                      interactionMode,
                      starterKey: null,
                      scenarioKey: selectedScenario.key,
                    },
                    selectedScenario.key === recommendation.scenarioKey ? "recommended" : "manual"
                  )
                : undefined,
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-4 px-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="size-4 text-primary" />
          Speak practice
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Choose how you want to practice
            </h1>
            <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
              Free speech is open conversation. Guided is structured practice.
            </p>
          </div>
          {renderModeSwitch()}
        </div>
      </section>

      {selectedMode === "free_speech" ? renderFreeSpeechMode() : renderGuidedMode()}
    </div>
  );
}
