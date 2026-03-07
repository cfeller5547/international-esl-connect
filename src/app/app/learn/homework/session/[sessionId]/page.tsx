import { redirect } from "next/navigation";

export default async function LegacyHomeworkSessionRedirectPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  redirect(`/app/tools/homework/session/${sessionId}`);
}
