import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class AppError extends Error {
  readonly status: ContentfulStatusCode
  readonly code?: string

  constructor(
    message: string,
    options?: { cause?: unknown; status?: ContentfulStatusCode; code?: string },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'AppError'
    this.status = options?.status ?? 500
    this.code = options?.code
  }
}
