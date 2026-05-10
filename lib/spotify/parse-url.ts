import { InvalidUrl } from "../errors.ts";

const PLAYLIST_ID = /^[A-Za-z0-9]{22}$/;

/**
 * Extracts the playlist id from any of:
 *   - https://open.spotify.com/playlist/{id}
 *   - https://open.spotify.com/playlist/{id}?si=...
 *   - spotify:playlist:{id}
 *
 * Throws InvalidUrl for anything else.
 */
export function parsePlaylistUrl(input: string): string {
  if (typeof input !== "string") throw new InvalidUrl(String(input));
  const value = input.trim();
  if (value === "") throw new InvalidUrl(input);

  if (value.startsWith("spotify:")) {
    const parts = value.split(":");
    if (parts.length !== 3) throw new InvalidUrl(input);
    const [, kind, id] = parts;
    if (kind !== "playlist" || !id || !PLAYLIST_ID.test(id)) {
      throw new InvalidUrl(input);
    }
    return id;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidUrl(input);
  }

  if (url.protocol !== "https:") throw new InvalidUrl(input);
  if (url.hostname !== "open.spotify.com") throw new InvalidUrl(input);

  const segments = url.pathname.split("/").filter((s) => s.length > 0);
  if (segments.length !== 2) throw new InvalidUrl(input);
  const [kind, id] = segments;
  if (kind !== "playlist" || !id || !PLAYLIST_ID.test(id)) {
    throw new InvalidUrl(input);
  }
  return id;
}
