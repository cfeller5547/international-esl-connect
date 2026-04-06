export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { AppShell } from "@/components/ui-kit/app-shell";
import { PageShell } from "@/components/ui-kit/page-shell";
import { getAdminPreviewLevel, getCurrentUser, isAdminUserId } from "@/server/auth";
import { trackEvent } from "@/server/analytics";
import { ensureRuntimeBootstrap } from "@/server/runtime-bootstrap";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await ensureRuntimeBootstrap();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [admin, previewLevel] = await Promise.all([
    isAdminUserId(user.id),
    getAdminPreviewLevel(user.id),
  ]);

  await trackEvent({
    eventName: "app_shell_viewed",
    route: "/app",
    userId: user.id,
    properties: {},
  });

  return (
    <AppShell
      accountMenu={{
        isAdmin: admin,
        currentLevel: user.currentLevel,
        previewLevel,
      }}
    >
      <PageShell>{children}</PageShell>
    </AppShell>
  );
}
