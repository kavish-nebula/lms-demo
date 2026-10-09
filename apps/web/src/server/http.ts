import "server-only";
import { NextResponse } from "next/server";
import type * as z from "zod/v4";

/** JSON responses and errors for the /api/v1 route handlers: errors are always { error: { code, message } }. */

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });

export async function body<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "The request body is not valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, "invalid_body", parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  return parsed.data;
}

/** Wraps a handler so thrown ApiErrors become JSON errors and anything else a 500. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      console.error("[api]", e);
      return NextResponse.json({ error: { code: "internal", message: "Something went wrong on the server." } }, { status: 500 });
    }
  };
}
