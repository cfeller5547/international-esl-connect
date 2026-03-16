import Link from "next/link";

import { Logo } from "@/components/ui-kit/logo";
import { PageShell } from "@/components/ui-kit/page-shell";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PageShell className="min-h-screen py-8">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="ESL International Connect home">
          <Logo className="w-[160px] sm:w-[188px]" priority />
        </Link>
        <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
          <Link href="/login" className="hover:text-foreground">
            Log in
          </Link>
          <Link href="/get-started" className="hover:text-foreground">
            Get started
          </Link>
        </div>
      </div>
      <div className="flex flex-1 flex-col py-4 lg:py-8">{children}</div>
    </PageShell>
  );
}
