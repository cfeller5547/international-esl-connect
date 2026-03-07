import { z } from "zod";

import { getCurrentUser } from "@/server/auth";
import { AppError, toErrorResponse } from "@/server/errors";
import { ok, parseJson } from "@/server/http";
import { ReportService } from "@/server/services/report-service";

const schema = z.object({
  cardType: z.enum(["level", "conversation_milestone", "improvement", "level_up"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
    }

    const payload = await parseJson(request, schema);
    const { reportId } = await params;
    const shareCard = await ReportService.createShareCard({
      userId: user.id,
      reportId,
      cardType: payload.cardType,
    });

    return ok({
      shareCardId: shareCard.id,
      assetUrl: shareCard.assetUrl,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
