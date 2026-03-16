/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { AppError } from "@/server/errors";
import { serializeRealtimeClientSecret } from "@/server/realtime-client-secret";

describe("serializeRealtimeClientSecret", () => {
  it("falls back to the configured model when the echoed session model is missing", () => {
    expect(
      serializeRealtimeClientSecret(
        {
          value: "ek_test",
          expires_at: 1770000000,
          session: {
            type: "realtime",
          },
        },
        "gpt-realtime",
      ),
    ).toEqual({
      clientSecret: "ek_test",
      expiresAt: 1770000000,
      model: "gpt-realtime",
    });
  });

  it("uses the echoed realtime session model when it is present", () => {
    expect(
      serializeRealtimeClientSecret(
        {
          value: "ek_test",
          expires_at: 1770000000,
          session: {
            type: "realtime",
            model: "gpt-realtime-2025-08-28",
          },
        },
        "gpt-realtime",
      ),
    ).toEqual({
      clientSecret: "ek_test",
      expiresAt: 1770000000,
      model: "gpt-realtime-2025-08-28",
    });
  });

  it("throws a structured app error when the realtime secret payload is malformed", () => {
    expect(() =>
      serializeRealtimeClientSecret(
        {
          session: {
            type: "realtime",
          },
        },
        "gpt-realtime",
      ),
    ).toThrowError(AppError);

    expect(() =>
      serializeRealtimeClientSecret(
        {
          session: {
            type: "realtime",
          },
        },
        "gpt-realtime",
      ),
    ).toThrow(/Realtime voice setup failed/i);
  });
});
