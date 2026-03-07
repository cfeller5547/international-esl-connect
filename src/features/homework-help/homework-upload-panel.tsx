"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type HomeworkUploadPanelProps = {
  recentSessions: Array<{
    id: string;
    createdAt: string;
    status: string;
  }>;
};

export function HomeworkUploadPanel({
  recentSessions,
}: HomeworkUploadPanelProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    const pastedText = String(formData.get("pastedText") ?? "");

    const uploadFormData = new FormData();
    if (file instanceof File && file.size > 0) {
      uploadFormData.append("file", file);
      uploadFormData.append("inputType", file.type.includes("pdf") ? "pdf" : "image");
    } else {
      uploadFormData.append("text", pastedText);
      uploadFormData.append("inputType", "text");
    }

    const uploadResponse = await fetch("/api/v1/learn/homework/upload", {
      method: "POST",
      body: uploadFormData,
    });
    const uploadPayload = (await uploadResponse.json()) as {
      homeworkUploadId: string;
      status: string;
    };

    let currentStatus = uploadPayload.status;
    let pollingPayload = uploadPayload as
      | {
          homeworkUploadId: string;
          status: string;
          requiresReview?: boolean;
        }
      | undefined;

    while (
      currentStatus === "extracting_text" ||
      currentStatus === "segmenting_questions"
    ) {
      setStatusText(
        currentStatus === "extracting_text"
          ? "Extracting text from your assignment..."
          : "Segmenting questions..."
      );
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      const pollResponse = await fetch(
        `/api/v1/learn/homework/upload/${uploadPayload.homeworkUploadId}`
      );
      pollingPayload = (await pollResponse.json()) as typeof pollingPayload;
      currentStatus = pollingPayload?.status ?? "failed";
    }

    const sessionResponse = await fetch("/api/v1/learn/homework/session/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        homeworkUploadId: uploadPayload.homeworkUploadId,
      }),
    });

    const sessionPayload = (await sessionResponse.json()) as { sessionId: string };
    router.push(`/app/tools/homework/session/${sessionPayload.sessionId}`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">Upload assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input name="file" type="file" accept=".pdf,image/*" />
            <Textarea
              name="pastedText"
              rows={8}
              placeholder="Or paste the assignment text here."
            />
            {statusText ? <p className="text-sm text-muted-foreground">{statusText}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Uploading..." : "Upload assignment"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">Recent homework sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recent homework sessions yet.
            </p>
          ) : (
            recentSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => router.push(`/app/tools/homework/session/${session.id}`)}
                className="w-full rounded-2xl border border-border/70 bg-muted/30 px-4 py-4 text-left"
              >
                <p className="font-semibold text-foreground">Session {session.id.slice(0, 8)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(session.createdAt).toLocaleString()} · {session.status}
                </p>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
