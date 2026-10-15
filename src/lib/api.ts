
import axios, { type AxiosRequestConfig } from "axios";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Opts = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
};

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export async function api<T>(
  path: string,
  { method = "GET", body, query }: Opts = {}
): Promise<T> {
  try {
    const config: AxiosRequestConfig = {
      url: `/api${path}`,
      method,
      params: query,
      data: body,
      withCredentials: true,
      headers:
        body !== undefined
          ? { "Content-Type": "application/json" }
          : undefined,
    };

    const response = await axios.request<unknown>(config);
    const payload = response.data;

    // Support both { data: T } and direct T responses.
    if (
      payload !== null &&
      typeof payload === "object" &&
      "data" in payload
    ) {
      return (payload as { data: T }).data;
    }

    return payload as T;
  } catch (error: unknown) {
    if (axios.isAxiosError<ApiErrorResponse>(error)) {
      const status = error.response?.status ?? 0;
      const apiError = error.response?.data?.error;

      throw new ApiError(
        status,
        apiError?.code ?? "ERROR",
        apiError?.message ?? error.message ?? "Request failed",
        apiError?.details
      );
    }

    throw error;
  }
}

export function fieldErrors(e: unknown): Record<string, string> {
  if (e instanceof ApiError && Array.isArray(e.details)) {
    return Object.fromEntries(
      (e.details as { path: string; message: string }[])
        .filter((d) => d && typeof d.path === "string")
        .map((d) => [d.path, d.message])
    );
  }

  return {};
}

export const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";
