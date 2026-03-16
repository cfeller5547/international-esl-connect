import { NextResponse } from "next/server";

type ErrorResponseOverrides = {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
};

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status = 400,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function toErrorResponse(error: unknown, overrides: ErrorResponseOverrides = {}) {
  const requestId = crypto.randomUUID();

  if (error instanceof AppError) {
    console.error(`[${requestId}]`, error);

    return NextResponse.json(
      {
        error: {
          code: overrides.code ?? error.code,
          message: overrides.message ?? error.message,
          details: {
            ...error.details,
            ...overrides.details,
            requestId,
          },
        },
      },
      { status: error.status }
    );
  }

  console.error(`[${requestId}]`, error);

  return NextResponse.json(
    {
      error: {
        code: overrides.code ?? "INTERNAL_SERVER_ERROR",
        message: overrides.message ?? "Something went wrong.",
        details: {
          ...overrides.details,
          requestId,
        },
      },
    },
    { status: 500 }
  );
}

export function invariant(
  condition: unknown,
  code: string,
  message: string,
  status = 400,
  details: Record<string, unknown> = {}
): asserts condition {
  if (!condition) {
    throw new AppError(code, message, status, details);
  }
}
