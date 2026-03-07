"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type ShareCardButtonProps = {
  reportId: string;
};

export function ShareCardButton({ reportId }: ShareCardButtonProps) {
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleGenerate() {
    setPending(true);
    const response = await fetch(`/api/v1/progress/reports/${reportId}/share-card`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cardType: "improvement",
      }),
    });
    const payload = (await response.json()) as { assetUrl?: string };
    setAssetUrl(payload.assetUrl ?? null);
    setPending(false);
  }

  return (
    <div className="space-y-3">
      <Button variant="secondary" onClick={handleGenerate} disabled={pending}>
        {pending ? "Generating..." : "Generate share card"}
      </Button>
      {assetUrl ? (
        <a
          href={assetUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-full border border-border/70 px-4 py-2 text-sm font-semibold text-foreground"
        >
          Open share card
        </a>
      ) : null}
    </div>
  );
}

