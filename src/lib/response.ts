import { NextResponse } from "next/server";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown;
  meta?: MetaData;
};

export type MetaData = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// Helper function for successful responses
export function formatResponse<T>({
  data,
  message = "Operation completed successfully",
  status = 200,
  meta,
}: {
  data: T;
  message?: string;
  status?: number;
  meta?: MetaData;
}) {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      message,
      data,
      meta,
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
