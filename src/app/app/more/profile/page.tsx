import { trackEvent } from "@/server/analytics";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/prisma";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/ui-kit/page-shell";

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const classContext = await prisma.classContextProfile.findUnique({
    where: { userId: user.id },
  });

  async function saveProfile(formData: FormData) {
    "use server";

    const user = await getCurrentUser();
    if (!user) return;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: String(formData.get("firstName") ?? user.firstName ?? ""),
      },
    });

    await prisma.classContextProfile.upsert({
      where: { userId: user.id },
      update: {
        schoolName: String(formData.get("schoolName") ?? ""),
        className: String(formData.get("className") ?? ""),
        instructorName: String(formData.get("instructorName") ?? ""),
        periodLabel: String(formData.get("periodLabel") ?? ""),
      },
      create: {
        userId: user.id,
        schoolName: String(formData.get("schoolName") ?? ""),
        className: String(formData.get("className") ?? ""),
        instructorName: String(formData.get("instructorName") ?? ""),
        periodLabel: String(formData.get("periodLabel") ?? ""),
      },
    });

    await trackEvent({
      eventName: "profile_updated",
      route: "/app/more/profile",
      userId: user.id,
      properties: {},
    });
  }

  return (
    <PageShell className="px-0 py-0">
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">Profile and class context</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveProfile} className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" name="firstName" defaultValue={user.firstName ?? ""} />
            <Field label="School" name="schoolName" defaultValue={classContext?.schoolName ?? ""} />
            <Field label="Class name" name="className" defaultValue={classContext?.className ?? ""} />
            <Field
              label="Instructor"
              name="instructorName"
              defaultValue={classContext?.instructorName ?? ""}
            />
            <Field label="Period" name="periodLabel" defaultValue={classContext?.periodLabel ?? ""} />
            <div className="sm:col-span-2">
              <Button type="submit" className="w-full">
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}

function Field({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue} />
    </div>
  );
}

