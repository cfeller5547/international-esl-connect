"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ManualTopicsForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [defaults] = useState(() => {
    const today = new Date();
    const end = new Date(today.getTime() + 1000 * 60 * 60 * 24 * 14);
    return {
      today: today.toISOString().slice(0, 10),
      inTwoWeeks: end.toISOString().slice(0, 10),
    };
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const topics = String(formData.get("topics") ?? "")
      .split(/,|\n/)
      .map((topic) => topic.trim())
      .filter(Boolean);

    await fetch("/api/v1/context/topics", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topics,
        activeFrom: formData.get("activeFrom"),
        activeTo: formData.get("activeTo"),
      }),
    });

    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="topics">What are you studying this week?</Label>
        <Textarea
          id="topics"
          name="topics"
          rows={4}
          placeholder="preterite tense, chapter 3 vocabulary, direct object pronouns"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="activeFrom">Active from</Label>
          <Input
            id="activeFrom"
            name="activeFrom"
            type="date"
            defaultValue={defaults.today}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="activeTo">Active to</Label>
          <Input
            id="activeTo"
            name="activeTo"
            type="date"
            defaultValue={defaults.inTwoWeeks}
            required
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving..." : "Add weekly topics"}
      </Button>
    </form>
  );
}
