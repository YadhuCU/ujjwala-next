export class AppError extends Error {
  statusCode: number;
  errors?: unknown;

  constructor(message: string, statusCode = 500, errors?: unknown) {
    super(message);

    this.statusCode = statusCode;
    this.errors = errors;

    // Restore the prototype of whichever subclass was actually constructed.
    // Pinning it to AppError.prototype here would make `err instanceof
    // ForbiddenError` false for every subclass, and name them all "AppError".
    const proto = new.target?.prototype ?? AppError.prototype;
    Object.setPrototypeOf(this, proto);

    this.name = new.target?.name ?? "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Record not found") {
    super(message, 404);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", errors?: unknown) {
    super(message, 400, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", errors?: unknown) {
    super(message, 409, errors);
  }
}
