import { SpotifyAuthError, SpotifyRateLimit } from "../errors.ts";

const API_BASE = "https://api.spotify.com";

/**
 * Authenticated Spotify Web API fetch using a user access token from the
 * Authorization Code flow. Accepts either an absolute URL (e.g. a `next`
 * cursor link) or an API path (`/v1/...`).
 *
 * 429 → SpotifyRateLimit (with Retry-After).
 * 401 → SpotifyAuthError so the caller can clear the session.
 */
export async function spotifyFetch(
  token: string,
  pathOrUrl: string,
  init?: RequestInit,
): Promise<Response> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE}${pathOrUrl}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (res.status === 429) {
    const raw = res.headers.get("Retry-After");
    const parsed = raw === null ? 1 : Number(raw);
    const retryAfter = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    throw new SpotifyRateLimit(retryAfter);
  }
  if (res.status === 401) {
    throw new SpotifyAuthError("Spotify rejected access token (401)");
  }
  return res;
}
