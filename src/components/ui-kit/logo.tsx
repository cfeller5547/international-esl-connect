import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoProps = {
  kind?: "lockup" | "icon";
  variant?: "color" | "onPrimary";
  className?: string;
  priority?: boolean;
};

const logoAssets = {
  lockup: {
    color: {
      src: "/brand/logo-lockup-color.svg",
      width: 440,
      height: 80,
    },
    onPrimary: {
      src: "/brand/logo-lockup-on-primary.svg",
      width: 440,
      height: 80,
    },
  },
  icon: {
    color: {
      src: "/brand/logo-icon-color.svg",
      width: 100,
      height: 100,
    },
  },
} as const;

export function Logo({
  kind = "lockup",
  variant = "color",
  className,
  priority = false,
}: LogoProps) {
  const asset =
    kind === "icon"
      ? logoAssets.icon.color
      : variant === "onPrimary"
        ? logoAssets.lockup.onPrimary
        : logoAssets.lockup.color;

  return (
    <Image
      src={asset.src}
      alt="ESL International Connect"
      width={asset.width}
      height={asset.height}
      priority={priority}
      className={cn("h-auto shrink-0", className)}
    />
  );
}
