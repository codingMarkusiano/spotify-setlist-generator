import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/spotify/oauth";
import { STATE_COOKIE, STATE_MAX_AGE_SECONDS } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const state = randomBytes(16).toString("hex");
  const url = buildAuthorizeUrl(state);
  const res = NextResponse.redirect(url, { status: 302 });
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
