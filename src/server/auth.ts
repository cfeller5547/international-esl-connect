import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cache } from "react";

import { Prisma } from "@/generated/prisma/client";
import {
  isCurriculumLevel,
  type CurriculumLevel,
} from "@/server/curriculum-levels";
import { prisma } from "@/server/prisma";

import { env } from "./env";

export const AUTH_COOKIE = "esl_auth";
export const APP_SESSION_COOKIE = "esl_app_session";
export const ADMIN_PREVIEW_LEVEL_COOKIE = "esl_admin_preview_level";

type AuthPayload = {
  userId: string;
  email: string;
};

type CurrentUser = Prisma.UserGetPayload<{
  include: {
    subscription: true;
    userStreak: true;
  };
}>;

async function getSecret() {
  return new TextEncoder().encode(env.SESSION_SECRET);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createAuthToken(payload: AuthPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(await getSecret());
}

export const readAuthPayload = cache(async function readAuthPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify<AuthPayload>(token, await getSecret());
    return verified.payload;
  } catch {
    return null;
  }
});

export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const payload = await readAuthPayload();

  if (!payload?.userId) {
    return null;
  }

  try {
    return await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        subscription: true,
        userStreak: true,
      },
    });
  } catch (error) {
    console.error("auth:getCurrentUser relation lookup failed", error);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return null;
    }

    return {
      ...user,
      subscription: null,
      userStreak: null,
    };
  } catch (error) {
    console.error("auth:getCurrentUser fallback lookup failed", error);
    return null;
  }
});

export const isAdminUserId = cache(async function isAdminUserId(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ role: string | null }>>(
    Prisma.sql`SELECT role FROM users WHERE id = ${userId}::uuid LIMIT 1`
  );

  return rows[0]?.role === "admin";
});

export const getAdminPreviewLevel = cache(async function getAdminPreviewLevel(
  userId: string
): Promise<CurriculumLevel | null> {
  if (!(await isAdminUserId(userId))) {
    return null;
  }

  let value: string | undefined;

  try {
    const cookieStore = await cookies();
    value = cookieStore.get(ADMIN_PREVIEW_LEVEL_COOKIE)?.value;
  } catch {
    return null;
  }

  if (!value) {
    return null;
  }

  return isCurriculumLevel(value) ? value : null;
});

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

export async function setAuthSession(user: AuthPayload) {
  const cookieStore = await cookies();
  const token = await createAuthToken(user);

  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  if (!cookieStore.get(APP_SESSION_COOKIE)?.value) {
    cookieStore.set(APP_SESSION_COOKIE, crypto.randomUUID(), {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  cookieStore.delete(ADMIN_PREVIEW_LEVEL_COOKIE);
}

export async function ensureAppSessionId() {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(APP_SESSION_COOKIE)?.value;

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    cookieStore.set(APP_SESSION_COOKIE, sessionId, {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return sessionId;
}

export async function setAdminPreviewLevelCookie(level: CurriculumLevel | null) {
  const cookieStore = await cookies();

  if (!level) {
    cookieStore.delete(ADMIN_PREVIEW_LEVEL_COOKIE);
    return;
  }

  cookieStore.set(ADMIN_PREVIEW_LEVEL_COOKIE, level, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
