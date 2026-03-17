"use client";

import Link from "next/link";

import { trackClientEvent } from "@/lib/client-analytics";

type TrackedLinkProps = React.ComponentProps<typeof Link> & {
  eventName?: string;
  route?: string;
  properties?: Record<string, unknown>;
};

export function TrackedLink({
  eventName,
  route,
  properties,
  onClick,
  ...props
}: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);

        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        if (eventName && route) {
          trackClientEvent({
            eventName,
            route,
            properties,
          });
        }
      }}
    />
  );
}
