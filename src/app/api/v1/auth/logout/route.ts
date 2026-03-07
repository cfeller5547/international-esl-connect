import { clearAuthSession } from "@/server/auth";
import { ok } from "@/server/http";

export async function POST() {
  await clearAuthSession();

  return ok({
    signedOut: true,
  });
}
