import { ok } from "@/server/http";
import { SpeakService } from "@/server/services/speak-service";

export async function GET() {
  const starters = await SpeakService.getStarters();
  return ok({ starters });
}
