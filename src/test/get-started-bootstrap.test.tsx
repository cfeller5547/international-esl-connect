import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GetStartedBootstrap } from "@/features/onboarding/get-started-bootstrap";

const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

describe("GetStartedBootstrap", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes into onboarding profile when session bootstrap succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn(),
      }),
    );

    render(<GetStartedBootstrap />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/onboarding/profile");
      expect(refreshMock).toHaveBeenCalled();
    });
  });

  it("shows traceable error details when session bootstrap fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          error: {
            code: "ONBOARDING_SESSION_CREATE_FAILED",
            message: "We could not create your onboarding session.",
            details: {
              requestId: "req_123",
              stage: "guest_session_bootstrap",
            },
          },
        }),
      }),
    );

    render(<GetStartedBootstrap />);

    expect(await screen.findByText("We could not start onboarding")).toBeInTheDocument();
    expect(screen.getByText(/ONBOARDING_SESSION_CREATE_FAILED/)).toBeInTheDocument();
    expect(screen.getByText(/req_123/)).toBeInTheDocument();
    expect(screen.getByText(/guest_session_bootstrap/)).toBeInTheDocument();
  });
});
