import { redirect } from "next/navigation";

import { AppShell } from "@/components/ui-kit/app-shell";
import { PageShell } from "@/components/ui-kit/page-shell";
import { getCurrentUser } from "@/server/auth";
import { bootstrapDatabase } from "@/server/bootstrap-data";
import { trackEvent } from "@/server/analytics";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await bootstrapDatabase();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  await trackEvent({
    eventName: "app_shell_viewed",
    route: "/app",
    userId: user.id,
    properties: {},
  });

  return (
    <AppShell>
      <PageShell>{children}</PageShell>
    </AppShell>
  );
}

