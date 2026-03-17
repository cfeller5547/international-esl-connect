import { cn } from "@/lib/utils";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageShell({ children, className }: PageShellProps) {
  return (
    <main
      className={cn(
        "mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-8",
        className
      )}
    >
      {children}
    </main>
  );
}
