export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export type BorrowerFacingError = { code: string; message: string };

export function toBorrowerError(error: unknown): BorrowerFacingError {
  if (error instanceof ApiClientError) return { code: error.code, message: error.message };
  if (error instanceof Error) return { code: 'REQUEST_FAILED', message: error.message };
  return { code: 'REQUEST_FAILED', message: 'Action failed. Please retry.' };
}
