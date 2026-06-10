import { NextResponse } from "next/server";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown;
};

// Helper function for successful responses
export function formatResponse<T>({
  data,
  message = "Operation completed successfully",
  status = 200,
}: {
  data: T;
  message?: string;
  status?: number;
}) {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      message,
      data,
    },
    { status },
  );
}

// Helper function for error responses
export function formatErrorResponse(
  message = "An error occurred",
  status = 500,
  errors?: unknown,
) {
  return NextResponse.json<ApiResponse<null>>(
    {
      success: false,
      message,
      data: null,
      errors,
    },
    { status },
  );
}
