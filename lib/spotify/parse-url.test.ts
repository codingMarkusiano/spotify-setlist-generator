import { describe, expect, it } from "vitest";
import { parsePlaylistUrl } from "./parse-url";
import { InvalidUrl } from "@/lib/errors";

const ID = "37i9dQZF1DXcBWIGoYBM5M"; // 22 chars, base62 — Spotify "Today's Top Hits" id format

describe("parsePlaylistUrl", () => {
  describe("accepted forms", () => {
    it("https://open.spotify.com/playlist/{id}", () => {
      expect(parsePlaylistUrl(`https://open.spotify.com/playlist/${ID}`)).toBe(ID);
    });

    it("https://open.spotify.com/playlist/{id}?si=...", () => {
      expect(
        parsePlaylistUrl(`https://open.spotify.com/playlist/${ID}?si=abc123def456`),
      ).toBe(ID);
    });

    it("https URL with a trailing slash before the query string", () => {
      // Spotify share copy sometimes appends extra params; tolerate them.
      expect(
        parsePlaylistUrl(`https://open.spotify.com/playlist/${ID}?si=x&pi=y`),
      ).toBe(ID);
    });

    it("spotify:playlist:{id}", () => {
      expect(parsePlaylistUrl(`spotify:playlist:${ID}`)).toBe(ID);
    });

    it("trims surrounding whitespace", () => {
      expect(parsePlaylistUrl(`   https://open.spotify.com/playlist/${ID}   `)).toBe(ID);
    });
  });

  describe("rejected forms", () => {
    const reject = (input: string) =>
      expect(() => parsePlaylistUrl(input)).toThrow(InvalidUrl);

    it("empty string", () => reject(""));
    it("only whitespace", () => reject("   "));
    it("plain id (no scheme/host)", () => reject(ID));
    it("non-spotify host", () =>
      reject(`https://example.com/playlist/${ID}`));
    it("http (insecure)", () =>
      reject(`http://open.spotify.com/playlist/${ID}`));
    it("track URL, not playlist", () =>
      reject(`https://open.spotify.com/track/${ID}`));
    it("album URL, not playlist", () =>
      reject(`https://open.spotify.com/album/${ID}`));
    it("user URL, not playlist", () =>
      reject(`https://open.spotify.com/user/someone`));
    it("playlist path with no id", () =>
      reject(`https://open.spotify.com/playlist/`));
    it("playlist path with too-short id", () =>
      reject(`https://open.spotify.com/playlist/abc`));
    it("playlist path with too-long id", () =>
      reject(`https://open.spotify.com/playlist/${ID}extra`));
    it("playlist path with non-base62 id", () =>
      reject(`https://open.spotify.com/playlist/${"!".repeat(22)}`));
    it("intl-prefixed URL (currently unsupported by spec)", () =>
      reject(`https://open.spotify.com/intl-es/playlist/${ID}`));
    it("spotify URI with wrong kind", () =>
      reject(`spotify:track:${ID}`));
    it("spotify URI without id", () =>
      reject(`spotify:playlist:`));
    it("spotify URI with extra colons", () =>
      reject(`spotify:playlist:${ID}:foo`));
    it("garbage string", () => reject("not a url"));
    it("javascript: URL", () => reject(`javascript:alert(1)`));
  });
});
