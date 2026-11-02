import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";

/** Typed API error → `{ error: { code, message, details } }` (SRS §8.3). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const unauthorized = () => new ApiError(401, "UNAUTHENTICATED", "Please sign in again");
export const forbidden = (message = "You don't have permission to do this") => new ApiError(403, "FORBIDDEN", message);
export const notFound = (what = "Record") => new ApiError(404, "NOT_FOUND", `${what} not found`);
export const conflict = (code: string, message: string, details?: Record<string, unknown>) =>
  new ApiError(409, code, message, details);
export const badRequest = (code: string, message: string, details?: Record<string, unknown>) =>
  new ApiError(422, code, message, details);

function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      fields[key] ??= issue.message;
    }
    return NextResponse.json(
      { error: { code: "VALIDATION", message: Object.values(fields)[0] ?? "Check the highlighted fields", details: { fields } } },
      { status: 422 },
    );
  }
  // Postgres unique violation → friendly 409
  if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "23505") {
    return NextResponse.json({ error: { code: "DUPLICATE", message: "This already exists" } }, { status: 409 });
  }
  console.error("[api] unhandled", err);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/** CSRF (NFR-SEC-03): SameSite=Lax cookie + Origin must match Host on state-changing requests. */
function checkOrigin(req: NextRequest) {
  if (SAFE.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (no ambient cookies) — session still required
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host === host) return;
  } catch {
    /* fall through */
  }
  throw new ApiError(403, "BAD_ORIGIN", "Request blocked");
}

type RouteCtx<P> = { params: Promise<P> };

/** Wraps a route handler with origin check and uniform error responses. */
export function route<P = Record<string, string>>(
  fn: (req: NextRequest, params: P) => Promise<Response | unknown>,
) {
  return async (req: NextRequest, ctx: RouteCtx<P>) => {
    try {
      checkOrigin(req);
      const out = await fn(req, (await ctx.params) ?? ({} as P));
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("BAD_JSON", "Invalid request body");
  }
  return schema.parse(json);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
}
