import { toErrorResponse } from "@/server/errors";
import { ok } from "@/server/http";
import { ContentService } from "@/server/services/content-service";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params;
    const item = await ContentService.getItem(contentId);
    return ok(item);
  } catch (error) {
    return toErrorResponse(error);
  }
}
