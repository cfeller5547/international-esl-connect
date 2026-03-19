import { z } from "zod";

import { trackEvent } from "@/server/analytics";
import { setAuthSession, verifyPassword } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { prisma } from "@/server/prisma";
import { UsageService } from "@/server/services/usage-service";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const payload = await parseJson(request, schema);
    const user = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
    });

    if (!user) {
      throw new AppError("VALIDATION_ERROR", "Invalid email or password.", 401);
    }

    const valid = await verifyPassword(payload.password, user.passwordHash);
    if (!valid) {
      throw new AppError("VALIDATION_ERROR", "Invalid email or password.", 401);
    }

    await UsageService.getOrCreateSubscription(user.id);

    await setAuthSession({
      userId: user.id,
      email: user.email,
    });

    await trackEvent({
      eventName: "login_completed",
      route: "/login",
      userId: user.id,
      properties: {
        entry_route: "/login",
      },
    });

    return ok({
      userId: user.id,
      redirectTo: "/app/home",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
