/**
 * Visual smoke test: build a few sample .docx files at different track counts
 * (one per layout bucket) and write them to scripts/out/ for opening in
 * Word / LibreOffice / Pages.
 *
 * Usage:
 *   node scripts/check-docx.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSetlist, setlistFilename } from "../lib/docx/build-setlist.ts";
import type { Playlist, Track } from "../lib/spotify/types.ts";

function fakePlaylist(title: string, count: number): Playlist {
  const tracks: Track[] = Array.from({ length: count }, (_, i) => {
    const title = i % 5 === 0
      ? `Long Title That Should Wrap At Some Point In The Layout (${i + 1})`
      : `Track ${i + 1}`;
    const artists = i % 4 === 0 ? [`Artist ${i + 1}`, `Featured ${i + 1}`] : [`Artist ${i + 1}`];
    return { position: i + 1, title, artists, durationMs: 180_000 + (i % 7) * 20_000 };
  });
  return {
    id: `fake-${count}`,
    title,
    tracks,
    totalDurationMs: tracks.reduce((s, t) => s + t.durationMs, 0),
  };
}

async function main(): Promise<void> {
  const outDir = path.resolve(import.meta.dirname, "out");
  await mkdir(outDir, { recursive: true });

  const samples: { name: string; count: number }[] = [
    { name: "Pequeña — 12 canciones", count: 12 },
    { name: "Mediana — 30 canciones", count: 30 },
    { name: "Grande — 50 canciones", count: 50 },
    { name: "Maratón — 80 canciones", count: 80 },
  ];

  for (const s of samples) {
    const pl = fakePlaylist(s.name, s.count);
    const buf = await buildSetlist(pl);
    const filename = setlistFilename(pl.title);
    const fullPath = path.join(outDir, filename);
    await writeFile(fullPath, buf);
    console.log(`wrote ${fullPath} (${buf.length} bytes, ${s.count} tracks)`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
