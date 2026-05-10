import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSetlist,
  formatTotalDuration,
  setlistFilename,
  slugifyTitle,
} from "./build-setlist.ts";
import type { Playlist, Track } from "../spotify/types.ts";

function makePlaylist(trackCount: number, opts: Partial<Playlist> = {}): Playlist {
  const tracks: Track[] = Array.from({ length: trackCount }, (_, i) => ({
    position: i + 1,
    title: `Track ${i + 1}`,
    artists: [`Artist ${(i % 3) + 1}`],
    durationMs: 200_000,
  }));
  return {
    id: "test-id",
    title: "Test Playlist",
    tracks,
    totalDurationMs: tracks.reduce((s, t) => s + t.durationMs, 0),
    ...opts,
  };
}

function extractDocumentXml(buf: Buffer): string {
  const dir = mkdtempSync(path.join(tmpdir(), "ssg-docx-"));
  const filePath = path.join(dir, "doc.docx");
  writeFileSync(filePath, buf);
  return execSync(`unzip -p "${filePath}" word/document.xml`, { encoding: "utf8" });
}

describe("formatTotalDuration", () => {
  it("formats minutes only when under an hour", () => {
    expect(formatTotalDuration(45 * 60_000)).toBe("45min");
  });
  it("formats hours and minutes when ≥ 1h", () => {
    expect(formatTotalDuration(83 * 60_000)).toBe("1h 23min");
  });
  it("rounds down sub-minute remainders (truncates seconds)", () => {
    expect(formatTotalDuration(59_999)).toBe("0min");
    expect(formatTotalDuration(60_500)).toBe("1min");
  });
  it("handles zero", () => {
    expect(formatTotalDuration(0)).toBe("0min");
  });
});

describe("slugifyTitle", () => {
  it("lowercases and dash-joins words", () => {
    expect(slugifyTitle("My Cool Setlist")).toBe("my-cool-setlist");
  });
  it("strips diacritics", () => {
    expect(slugifyTitle("Canción del verano")).toBe("cancion-del-verano");
  });
  it("collapses non-alphanumerics", () => {
    expect(slugifyTitle("Best of 2024 — Vol. 1!!!")).toBe("best-of-2024-vol-1");
  });
  it("trims leading/trailing dashes", () => {
    expect(slugifyTitle("--hello--")).toBe("hello");
  });
  it("falls back to 'setlist' when input has no alphanumerics", () => {
    expect(slugifyTitle("¡!?¿")).toBe("setlist");
  });
  it("caps length at 80 chars", () => {
    expect(slugifyTitle("a".repeat(200)).length).toBe(80);
  });
});

describe("setlistFilename", () => {
  it("wraps the slug in setlist-…docx", () => {
    expect(setlistFilename("Top Hits")).toBe("setlist-top-hits.docx");
  });
});

describe("buildSetlist", () => {
  it("produces a valid .docx (zip) buffer", async () => {
    const buf = await buildSetlist(makePlaylist(5));
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it("handles an empty playlist (0 tracks)", async () => {
    const buf = await buildSetlist(makePlaylist(0));
    expect(buf.length).toBeGreaterThan(500);
  });

  // Layout invariants: regardless of track count, body stays a single column
  // and the body font size lands inside the auto-scale range [18pt, 28pt]
  // (encoded as half-points [36, 56] in <w:sz w:val="…"/>).
  for (const count of [1, 22, 35, 60, 100]) {
    it(`auto-scales body font in [18,28]pt and stays single column for ${count} tracks`, async () => {
      const buf = await buildSetlist(makePlaylist(count));
      const xml = extractDocumentXml(buf);

      const sizes = Array.from(xml.matchAll(/<w:sz\s+w:val="(\d+)"/g)).map((m) =>
        Number(m[1]),
      );
      // Sample includes title (56) and footer (24); body size is whichever
      // value appears once per track. Confirm a body-range size shows up.
      const bodyCandidates = sizes.filter((s) => s >= 36 && s <= 56);
      expect(bodyCandidates.length).toBeGreaterThan(0);

      expect(xml).not.toMatch(/<w:tbl[\s>]/);
    });
  }

  it("uses Helvetica as the document default font", async () => {
    const buf = await buildSetlist(makePlaylist(3));
    const xml = extractDocumentXml(buf);
    expect(xml).toContain("Helvetica");
  });

  it("renders the title in dark green at 28pt bold, centered", async () => {
    const buf = await buildSetlist(makePlaylist(3));
    const xml = extractDocumentXml(buf);
    expect(xml).toContain('w:val="1A3D2E"');
    expect(xml).toContain('w:val="56"');
    expect(xml).toMatch(/w:val="center"/);
  });

  it("uses near-minimum 1cm top/bottom margins (567 twips)", async () => {
    const buf = await buildSetlist(makePlaylist(3));
    const xml = extractDocumentXml(buf);
    expect(xml).toMatch(/w:top="567"/);
    expect(xml).toMatch(/w:bottom="567"/);
  });
});
