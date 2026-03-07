import { PageShell } from "@/components/ui-kit/page-shell";
import { SettingsForm } from "@/features/more/settings-form";
import { getCurrentUser } from "@/server/auth";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <PageShell className="px-0 py-0">
      <SettingsForm />
    </PageShell>
  );
}
