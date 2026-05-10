import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const host = req.headers.get("host") ?? new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const home = new URL("/", `${proto}://${host}`);
  const res = NextResponse.redirect(home, { status: 302 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
