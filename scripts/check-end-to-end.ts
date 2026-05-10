/**
 * End-to-end smoke: parse URL → fetch real Spotify playlist → build .docx → write.
 *
 * This exercises every server-side piece (parse-url, client, playlist, layout,
 * build-setlist) against a real playlist. Open the resulting .docx in
 * Word / LibreOffice / Pages to verify layout.
 *
 * Usage:
 *   node --env-file=.env.local scripts/check-end-to-end.ts <spotify-playlist-url>
 *
 * Example:
 *   node --env-file=.env.local scripts/check-end-to-end.ts \
 *     https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSetlist, setlistFilename } from "../lib/docx/build-setlist.ts";
import { parsePlaylistUrl } from "../lib/spotify/parse-url.ts";
import { getPlaylist } from "../lib/spotify/playlist.ts";

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node scripts/check-end-to-end.ts <spotify-playlist-url>");
    process.exit(2);
  }

  const token = process.env.SPOTIFY_USER_ACCESS_TOKEN;
  if (!token) {
    console.error(
      "Missing SPOTIFY_USER_ACCESS_TOKEN env var (a user access token from OAuth login).",
    );
    process.exit(2);
  }

  const id = parsePlaylistUrl(input);

  const t0 = Date.now();
  const playlist = await getPlaylist(token, id);
  const fetchMs = Date.now() - t0;

  const t1 = Date.now();
  const buf = await buildSetlist(playlist);
  const buildMs = Date.now() - t1;

  const outDir = path.resolve(import.meta.dirname, "out");
  await mkdir(outDir, { recursive: true });
  const filename = setlistFilename(playlist.title);
  const fullPath = path.join(outDir, filename);
  await writeFile(fullPath, buf);

  const totalMin = Math.floor(playlist.totalDurationMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const duration = h > 0 ? `${h}h ${m}min` : `${m}min`;

  console.log(JSON.stringify({
    id: playlist.id,
    title: playlist.title,
    trackCount: playlist.tracks.length,
    duration,
    fetchMs,
    buildMs,
    bytes: buf.length,
    out: fullPath,
  }, null, 2));
}

main().catch((err: unknown) => {
  if (err instanceof Error) {
    console.error(`[${err.name}] ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
