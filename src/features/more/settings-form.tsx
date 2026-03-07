"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function SettingsForm() {
  const [initialState] = useState(() => {
    if (typeof window === "undefined") {
      return {
        captionsEnabled: true,
        celebrationsEnabled: true,
      };
    }

    const stored = window.localStorage.getItem("esl-settings");
    if (!stored) {
      return {
        captionsEnabled: true,
        celebrationsEnabled: true,
      };
    }

    const parsed = JSON.parse(stored) as {
      captionsEnabled?: boolean;
      celebrationsEnabled?: boolean;
    };

    return {
      captionsEnabled: parsed.captionsEnabled ?? true,
      celebrationsEnabled: parsed.celebrationsEnabled ?? true,
    };
  });
  const [captionsEnabled, setCaptionsEnabled] = useState(initialState.captionsEnabled);
  const [celebrationsEnabled, setCelebrationsEnabled] = useState(
    initialState.celebrationsEnabled
  );
  const [saved, setSaved] = useState(false);

  function saveSettings() {
    window.localStorage.setItem(
      "esl-settings",
      JSON.stringify({
        captionsEnabled,
        celebrationsEnabled,
      })
    );

    void fetch("/api/v1/internal/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventName: "settings_updated",
        route: "/app/more/settings",
        properties: {
          captions_enabled: captionsEnabled,
          celebrations_enabled: celebrationsEnabled,
        },
      }),
    });

    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader>
        <CardTitle className="text-xl">Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ToggleRow
          label="Captions and transcript support"
          checked={captionsEnabled}
          onChange={setCaptionsEnabled}
        />
        <ToggleRow
          label="Celebration moments"
          checked={celebrationsEnabled}
          onChange={setCelebrationsEnabled}
        />
        <Button onClick={saveSettings} className="w-full">
          {saved ? "Saved settings" : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/30 px-4 py-4">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`h-8 w-14 rounded-full transition ${
          checked ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          className={`block h-6 w-6 rounded-full bg-white transition ${
            checked ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
