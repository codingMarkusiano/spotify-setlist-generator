import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { buildSetlist, setlistFilename } from "@/lib/docx/build-setlist";
import {
  InvalidUrl,
  PlaylistNotFound,
  SpotifyAuthError,
  SpotifyRateLimit,
  SpotifyUpstreamError,
} from "@/lib/errors";
import { consumeToken } from "@/lib/rate-limit";
import { parsePlaylistUrl } from "@/lib/spotify/parse-url";
import { getPlaylist } from "@/lib/spotify/playlist";
import { refreshAccess } from "@/lib/spotify/oauth";
import { GenerateRequestSchema } from "@/lib/validation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  decryptJson,
  encryptJson,
  type Session,
} from "@/lib/auth";

export const runtime = "nodejs";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const REFRESH_BUFFER_MS = 60_000;

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function jsonError(status: number, error: string): Response {
  return NextResponse.json({ error }, { status });
}

function clearedSessionResponse(status: number, error: string): Response {
  const res = NextResponse.json({ error }, { status });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

export async function POST(req: Request): Promise<Response> {
  const ip = getClientIp(req);
  if (!consumeToken(ip)) {
    return jsonError(429, "rate_limited");
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  const existing = raw ? decryptJson<Session>(raw) : null;
  if (!existing) {
    return jsonError(401, "auth_required");
  }

  let url: string;
  try {
    const rawBody: unknown = await req.json();
    url = GenerateRequestSchema.parse(rawBody).url;
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "invalid_body");
    return jsonError(400, "invalid_body");
  }

  // Refresh near-expiry token before hitting Spotify.
  let session: Session = existing;
  let refreshedSession: Session | null = null;
  if (existing.expiresAt - Date.now() <= REFRESH_BUFFER_MS) {
    try {
      const tokens = await refreshAccess(existing.refreshToken);
      refreshedSession = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      };
      session = refreshedSession;
    } catch {
      return clearedSessionResponse(401, "auth_required");
    }
  }

  const t0 = Date.now();
  try {
    const id = parsePlaylistUrl(url);
    const playlist = await getPlaylist(session.accessToken, id);
    const buf = await buildSetlist(playlist);
    const filename = setlistFilename(playlist.title);

    console.info(
      "generate.success",
      JSON.stringify({
        playlistId: playlist.id,
        trackCount: playlist.tracks.length,
        durationMs: Date.now() - t0,
      }),
    );

    const body = new Uint8Array(buf);
    const res = new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
    if (refreshedSession) {
      res.cookies.set(SESSION_COOKIE, encryptJson(refreshedSession), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
        secure: process.env.NODE_ENV === "production",
      });
    }
    return res;
  } catch (err) {
    const name = err instanceof Error ? err.name : "Unknown";
    console.error("generate.error", name);

    if (err instanceof InvalidUrl) return jsonError(400, "invalid_url");
    if (err instanceof PlaylistNotFound) return jsonError(404, "playlist_not_found");
    if (err instanceof SpotifyRateLimit) return jsonError(429, "spotify_rate_limit");
    if (err instanceof SpotifyAuthError) return clearedSessionResponse(401, "auth_required");
    if (err instanceof SpotifyUpstreamError) return jsonError(502, "spotify_upstream");
    return jsonError(500, "internal_error");
  }
}
