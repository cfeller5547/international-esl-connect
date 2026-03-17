"use client";

export type ClientAnalyticsPayload = {
  eventName: string;
  route: string;
  properties?: Record<string, unknown>;
};

export function trackClientEvent(payload: ClientAnalyticsPayload) {
  const body = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon(
      "/api/v1/internal/analytics",
      new Blob([body], { type: "application/json" })
    );

    if (sent) {
      return;
    }
  }

  void fetch("/api/v1/internal/analytics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  });
}
