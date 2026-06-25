"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Mic, Sparkles, Flame, TrendingUp, MessageCircle, Target } from "lucide-react";

import { getMissionIllustration } from "@/features/speak/speak-session-ui";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trackClientEvent } from "@/lib/client-analytics";
import type { SpeakLaunchViewModel } from "@/features/speak/speak-view-model";

type SpeakLaunchPanelProps = {
  viewModel: SpeakLaunchViewModel;
  voiceConfigured: boolean;
  plan: "free" | "pro";
};

type StartPayload = {
  type: "free_speech" | "mission";
  interactionMode: "text" | "voice";
  id: string | null;
};

export function SpeakLaunchPanel({
  viewModel,
  voiceConfigured,
  plan,
}: SpeakLaunchPanelProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"missions" | "free_speech">("missions");
  
  const defaultInteractionMode =
    voiceConfigured && plan === "pro" ? "voice" : "text";

  const [interactionMode, setInteractionMode] = useState<"text" | "voice">(
    defaultInteractionMode
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart(payload: StartPayload) {
    setPending(true);
    setError(null);

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
      </div>
    );
  }

  function renderDashboard() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Speaking Confidence</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight text-foreground">{viewModel.stats.confidenceScore}%</span>
                <TrendingUp className="size-5 text-primary mb-1" />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Grammar <span className="text-primary">↑</span> • Fluency <span className="text-muted-foreground">→</span> • Vocab <span className="text-primary">↑</span>
              </p>
            </div>
            <div className="size-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="size-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/70">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Current Streak</p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight text-foreground">{viewModel.stats.streak}</span>
                <span className="text-lg font-medium text-muted-foreground mb-1">days</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Practice today to keep it going!
              </p>
            </div>
            <div className="size-16 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Flame className={`size-8 text-orange-500`} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderMissions() {
    return (
      <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {viewModel.missions.map((mission) => {
            const illustration = getMissionIllustration(mission.title);
            return (
              <Card
                key={mission.id}
                className="group hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 flex flex-col h-full overflow-hidden cursor-pointer"
                onClick={() => !pending && handleStart({ type: "mission", id: mission.id, interactionMode })}
              >
                {/* Scene illustration — bright, colorful */}
                <div className="relative h-36 w-full overflow-hidden">
                  <Image
                    src={illustration}
                    alt={mission.title}
                    fill
                    className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm">
                      <Target className="size-3" />
                      Mission
                    </div>
                  </div>
                </div>

                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-base leading-snug">{mission.title}</CardTitle>
                </CardHeader>

                <CardContent className="flex-grow pb-3">
                  <p className="text-sm text-muted-foreground mb-3">{mission.objective}</p>
                  <ul className="space-y-1.5">
                    {mission.successCriteria.slice(0, 2).map((criteria, i) => (
                      <li key={i} className="text-xs flex items-start gap-2 text-muted-foreground">
                        <div className="size-1 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                        <span>{criteria}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-0 mt-auto pb-4">
                  <Button
                    className="w-full rounded-full"
                    size="sm"
                    disabled={pending}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStart({ type: "mission", id: mission.id, interactionMode });
                    }}
                  >
                    {interactionMode === "voice" ? <Mic className="size-3.5 mr-1.5" /> : <MessageCircle className="size-3.5 mr-1.5" />}
                    {pending ? "Starting..." : "Start"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>
    );
  }

  function renderFreeSpeech() {
    return (
      <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Hero card with illustration */}
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <div className="relative h-40 w-full overflow-hidden">
            <Image
              src="/illustrations/speak/free-talk.svg"
              alt="Free conversation"
              fill
              className="object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Open Conversation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Practice naturally with your AI tutor. No goals, no pressure — just talk.
              </p>
            </div>
          </div>

          <CardContent className="p-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {viewModel.freeSpeechStarters.map((starter) => (
                <button
                  key={starter.id}
                  type="button"
                  disabled={pending}
                  onClick={() => handleStart({ type: "free_speech", id: starter.id, interactionMode })}
                  className={`group rounded-xl border border-border/60 bg-card px-4 py-3.5 text-left transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm ${pending ? "opacity-70" : ""}`}
                >
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{starter.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{starter.prompt}</p>
                </button>
              ))}
            </div>

            <Button
              size="lg"
              className="w-full rounded-full"
              disabled={pending}
              onClick={() => handleStart({ type: "free_speech", id: null, interactionMode })}
            >
              {interactionMode === "voice" ? <Mic className="size-4 mr-2" /> : <MessageCircle className="size-4 mr-2" />}
              {pending ? "Starting..." : "Just start talking"}
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {renderDashboard()}
      
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="inline-flex w-full flex-col rounded-[1rem] border border-border/70 bg-card/80 p-1.5 shadow-sm sm:w-auto sm:flex-row">
            {[
              { key: "missions" as const, title: "Missions" },
              { key: "free_speech" as const, title: "Free Speech" },
            ].map((tab) => {
              const isSelected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-[0.8rem] px-4 py-2.5 text-center transition sm:min-w-[150px] ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground hover:bg-muted/40"
                  }`}
                >
                  <span className="font-semibold">{tab.title}</span>
                </button>
              );
            })}
          </div>
          
          <div className="w-full sm:w-48">
            {renderInteractionModeControl()}
          </div>
        </div>
        
        {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</p>}

        {activeTab === "missions" ? renderMissions() : renderFreeSpeech()}
      </div>
    </div>
  );
}
