export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: {
        ok: false,
        code: error.code,
        message: error.message,
      },
    };
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";

  return {
    status: 500,
    body: {
      ok: false,
      code: "ALPI-SYS-INT-500",
      message,
    },
  };
}
