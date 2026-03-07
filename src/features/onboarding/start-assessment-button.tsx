"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function StartAssessmentButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleStart() {
    setPending(true);

    const response = await fetch("/api/v1/onboarding/session", {
      method: "POST",
    });

    if (!response.ok) {
      setPending(false);
      return;
    }

    router.push("/onboarding/profile");
    router.refresh();
  }

  return (
    <Button size="lg" className="w-full sm:w-auto" onClick={handleStart} disabled={pending}>
      {pending ? "Starting..." : "Start assessment"}
    </Button>
  );
}

