import { AppError } from "./errors";

export function logError(error: unknown) {
  // Expected errors → don't spam logs
  if (error instanceof AppError) {
    return;
  }

  console.error({
    message: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  });
}
