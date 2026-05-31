export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message, 404)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409)
  }
}

export class InsufficientBalanceError extends AppError {
  constructor() {
    super('INSUFFICIENT_BALANCE', 'Insufficient balance', 400)
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(message: string) {
    super('INVALID_STATE_TRANSITION', message, 409)
  }
}
