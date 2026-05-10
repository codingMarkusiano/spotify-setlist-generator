import { SpotifyAuthError } from "../errors.ts";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
export const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";

// Reading public playlists technically needs no scopes, but this lets users
// generate setlists from their own private/collaborative playlists too.
export const REQUIRED_SCOPES = "playlist-read-private playlist-read-collaborative";

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

function readCreds(): { id: string; secret: string; redirectUri: string } {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!id || !secret || !redirectUri) {
    throw new SpotifyAuthError(
      "Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET / SPOTIFY_REDIRECT_URI",
    );
  }
  return { id, secret, redirectUri };
}

function basicAuthHeader(id: string, secret: string): string {
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

function tokenResponseToSet(json: unknown, fallbackRefreshToken?: string): TokenSet {
  if (!json || typeof json !== "object") {
    throw new SpotifyAuthError("Spotify token response not an object");
  }
  const obj = json as Record<string, unknown>;
  const access = obj.access_token;
  const expiresIn = obj.expires_in;
  const refresh = obj.refresh_token ?? fallbackRefreshToken;
  if (typeof access !== "string" || typeof expiresIn !== "number" || typeof refresh !== "string") {
    throw new SpotifyAuthError("Spotify token response missing required fields");
  }
  return {
    accessToken: access,
    refreshToken: refresh,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

export function buildAuthorizeUrl(state: string): string {
  const { id, redirectUri } = readCreds();
  const params = new URLSearchParams({
    client_id: id,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: REQUIRED_SCOPES,
    show_dialog: "false",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<TokenSet> {
  const { id, secret, redirectUri } = readCreds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(id, secret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new SpotifyAuthError(`Token exchange failed (${res.status})`);
  }
  return tokenResponseToSet(await res.json());
}

export async function refreshAccess(refreshToken: string): Promise<TokenSet> {
  const { id, secret } = readCreds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(id, secret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new SpotifyAuthError(`Token refresh failed (${res.status})`);
  }
  return tokenResponseToSet(await res.json(), refreshToken);
}
