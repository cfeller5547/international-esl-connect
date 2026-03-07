import { NextResponse } from "next/server";

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

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status }
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong.",
        details: {},
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

