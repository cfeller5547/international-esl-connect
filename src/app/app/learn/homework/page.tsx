import { redirect } from "next/navigation";

export default function LegacyHomeworkRedirectPage() {
  redirect("/app/tools/homework");
}
