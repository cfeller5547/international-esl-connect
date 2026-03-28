import { cookies } from "next/headers";
import { after } from "next/server";

import { APP_VERSION } from "@/lib/constants";
import { prisma } from "@/server/prisma";

import { APP_SESSION_COOKIE, ensureAppSessionId, readAuthPayload } from "./auth";

type TrackEventInput = {
  eventName: string;
  route: string;
  guestSessionToken?: string | null;
  userId?: string | null;
  properties?: Record<string, unknown>;
};

type ResolvedTrackEventInput = TrackEventInput & {
  guestSessionToken: string | null;
  userId: string | null;
  sessionId: string;
};

function isMissingRequestScopeError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("outside a request scope")
  );
}

function isCookieMutationDuringRenderError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(
      "Cookies can only be modified in a Server Action or Route Handler",
    )
  );
}

async function resolveTrackEventInput(
  input: TrackEventInput,
): Promise<ResolvedTrackEventInput> {
  let resolvedUserId = input.userId ?? null;
  let resolvedGuestSessionToken = input.guestSessionToken ?? null;
  let resolvedSessionId = `system-${crypto.randomUUID()}`;

  try {
    const cookieStore = await cookies();
    const auth = await readAuthPayload();

    resolvedUserId ??= auth?.userId ?? null;
    resolvedGuestSessionToken ??= cookieStore.get("guest_session")?.value ?? null;
    resolvedSessionId = cookieStore.get(APP_SESSION_COOKIE)?.value ?? resolvedSessionId;

    if (!cookieStore.get(APP_SESSION_COOKIE)?.value) {
      try {
        resolvedSessionId = await ensureAppSessionId();
      } catch (error) {
        if (!isCookieMutationDuringRenderError(error)) {
          throw error;
        }
      }
    }
  } catch (error) {
    if (!isMissingRequestScopeError(error)) {
      throw error;
    }
  }

  return {
    ...input,
    guestSessionToken: resolvedGuestSessionToken,
    userId: resolvedUserId,
    sessionId: resolvedSessionId,
  };
}

async function writeEvent({
  eventName,
  route,
  guestSessionToken,
  userId,
  sessionId,
  properties = {},
}: ResolvedTrackEventInput) {
  await prisma.analyticsEvent.create({
    data: {
      eventId: crypto.randomUUID(),
      eventName,
      route,
      userId,
      guestSessionToken,
      sessionId,
      appVersion: APP_VERSION,
      properties: properties as never,
    },
  });
}

export async function trackEvent(input: TrackEventInput) {
  let resolvedInput: ResolvedTrackEventInput;

  try {
    resolvedInput = await resolveTrackEventInput(input);
  } catch (error) {
    console.error("analytics:resolve failed", error);
    return;
  }

  try {
    after(async () => {
      try {
        await writeEvent(resolvedInput);
      } catch (error) {
        console.error("analytics:write failed", error);
      }
    });
    return;
  } catch (error) {
    if (!isMissingRequestScopeError(error)) {
      console.error("analytics:after scheduling failed", error);
      return;
    }
  }

  try {
    await writeEvent(resolvedInput);
  } catch (error) {
    console.error("analytics:write failed", error);
  }
}
