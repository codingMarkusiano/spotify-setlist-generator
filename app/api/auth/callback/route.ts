import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/spotify/oauth";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  STATE_COOKIE,
  encryptJson,
} from "@/lib/auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function homeUrl(req: Request, params?: Record<string, string>): URL {
  // Use the actual Host header so we redirect back to whatever hostname the
  // client used (127.0.0.1 vs localhost matters for cookies).
  const host = req.headers.get("host") ?? new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const u = new URL("/", `${proto}://${host}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  }
  return u;
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;

  function fail(reason: string): Response {
    const res = NextResponse.redirect(homeUrl(req, { auth_error: reason }), { status: 302 });
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  if (errorParam) return fail(errorParam);
  if (!code || !state || !expectedState || state !== expectedState) {
    return fail("invalid_state");
  }

  try {
    const tokens = await exchangeCode(code);
    const res = NextResponse.redirect(homeUrl(req), { status: 302 });
    res.cookies.delete(STATE_COOKIE);
    res.cookies.set(SESSION_COOKIE, encryptJson({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    }), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch {
    return fail("exchange_failed");
  }
}
