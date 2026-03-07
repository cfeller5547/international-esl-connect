import { cookies } from "next/headers";

import { toErrorResponse } from "@/server/errors";
import { ok } from "@/server/http";
import { OnboardingService } from "@/server/services/onboarding-service";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const { searchParams } = new URL(request.url);
    const guestSessionToken =
      searchParams.get("guestSessionToken") ?? cookieStore.get("guest_session")?.value;

    if (!guestSessionToken) {
      return ok({
        reportId: null,
        overallScore: null,
        levelLabel: null,
        skills: [],
      });
    }

    const report = await OnboardingService.getResults(guestSessionToken);

    if (!report) {
      return ok({
        reportId: null,
        overallScore: null,
        levelLabel: null,
        skills: [],
      });
    }

    return ok({
      reportId: report.id,
      overallScore: report.overallScore,
      levelLabel: report.levelLabel,
      skills: report.skillSnapshots.map((snapshot) => ({
        skill: snapshot.skill,
        score: snapshot.score,
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
