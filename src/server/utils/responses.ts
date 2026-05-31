import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AppError } from '@/server/domain/errors'

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function jsonError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues.map((issue) => issue.message).join('; ')
        }
      },
      { status: 400 }
    )
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message
        }
      },
      { status: error.status }
    )
  }

  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error'
      }
    },
    { status: 500 }
  )
}

export function requireIdempotencyKey(request: Request) {
  const key = request.headers.get('Idempotency-Key')

  if (!key?.trim()) {
    throw new AppError('MISSING_IDEMPOTENCY_KEY', 'Idempotency-Key header is required', 400)
  }

  return key.trim()
}
