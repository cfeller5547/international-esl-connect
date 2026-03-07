import { cookies } from "next/headers";
import { after } from "next/server";

import { APP_VERSION } from "@/lib/constants";
import { prisma } from "@/server/prisma";

import { ensureAppSessionId, readAuthPayload } from "./auth";

type TrackEventInput = {
  eventName: string;
  route: string;
  guestSessionToken?: string | null;
  userId?: string | null;
  properties?: Record<string, unknown>;
};

function isMissingRequestScopeError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("outside a request scope")
  );
}

async function writeEvent({
  eventName,
  route,
  guestSessionToken,
  userId,
  properties = {},
}: TrackEventInput) {
  let cookieStore: Awaited<ReturnType<typeof cookies>> | null = null;
  let auth: Awaited<ReturnType<typeof readAuthPayload>> = null;
  let sessionId = `system-${crypto.randomUUID()}`;

  try {
    cookieStore = await cookies();
    auth = await readAuthPayload();
    sessionId = await ensureAppSessionId();
  } catch (error) {
    if (!isMissingRequestScopeError(error)) {
      throw error;
    }
  }

  await prisma.analyticsEvent.create({
    data: {
      eventId: crypto.randomUUID(),
      eventName,
      route,
      userId: userId ?? auth?.userId ?? null,
      guestSessionToken:
        guestSessionToken ?? cookieStore?.get("guest_session")?.value ?? null,
      sessionId,
      appVersion: APP_VERSION,
      properties: properties as never,
    },
  });
}

export async function trackEvent(input: TrackEventInput) {
  try {
    after(async () => {
      await writeEvent(input);
    });
    return;
  } catch (error) {
    if (!isMissingRequestScopeError(error)) {
      throw error;
    }
  }

  await writeEvent(input);
}
