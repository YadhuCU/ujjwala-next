import { ZodError } from "zod";
import { formatErrorResponse } from "./response";
import { Prisma } from "@/generated/client";
import { AppError } from "./errors";

function getConstraintFields(
  error: Prisma.PrismaClientKnownRequestError,
): string[] {
  // Standard Prisma metadata
  if (Array.isArray(error.meta?.target)) {
    return error.meta.target as string[];
  }

  // Driver adapter metadata fallback
  const adapterFields = (
    error.meta as {
      driverAdapterError?: {
        cause?: {
          constraint?: {
            fields?: string[];
          };
        };
      };
    }
  )?.driverAdapterError?.cause?.constraint?.fields;

  if (Array.isArray(adapterFields)) {
    return adapterFields;
  }

  return [];
}

export function routeErrorHandler(error: unknown) {
  // App errors
  if (error instanceof AppError) {
    return formatErrorResponse(error.message, error.statusCode, error.errors);
  }
  // Zod validation
  if (error instanceof ZodError) {
    return formatErrorResponse(
      "Validation failed",
      422,
      error.flatten().fieldErrors,
    );
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const fields = getConstraintFields(error);

        return formatErrorResponse(
          `${fields.join(", ") || "Field"} already exists`,
          409,
          {
            field: fields,
          },
        );
      }

      case "P2025":
        return formatErrorResponse("Record not found", 404);

      case "P2003":
        return formatErrorResponse("Referenced record does not exist", 400);

      default:
        return formatErrorResponse("Database error", 500);
    }
  }

  // Prisma validation error
  if (error instanceof Prisma.PrismaClientValidationError) {
    return formatErrorResponse("Invalid database operation", 400);
  }

  // Generic errors
  if (error instanceof Error) {
    return formatErrorResponse(
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
      500,
    );
  }

  return formatErrorResponse("Unknown error occurred", 500);
}
