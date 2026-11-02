/** Thin client for /api/v1 — throws ApiClientError with the server's code/message/fields. */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { fields?: Record<string, string> } & Record<string, unknown>,
  ) {
    super(message);
  }
  get fields(): Record<string, string> {
    return this.details?.fields ?? {};
  }
}

type Opts = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: { ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}), ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      signal: opts.signal,
    });
  } catch {
    throw new ApiClientError(0, "OFFLINE", "You're offline. Check your connection and try again.");
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const e = (data as { error?: { code: string; message: string; details?: Record<string, unknown> } })?.error;
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/")) {
      window.location.href = "/login?expired=1";
    }
    throw new ApiClientError(res.status, e?.code ?? "HTTP_" + res.status, e?.message ?? "Something went wrong", e?.details);
  }
  return data as T;
}

export const errorMessage = (err: unknown) =>
  err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Something went wrong";
