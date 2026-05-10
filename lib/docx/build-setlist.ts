import {
  AlignmentType,
  BorderStyle,
  Document,
  LineRuleType,
  PageOrientation,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { Playlist, Track } from "../spotify/types.ts";
import { computeBodyLayout } from "./layout.ts";

// A4 page size in twips.
const A4_WIDTH_TWIPS = 11906;
const A4_HEIGHT_TWIPS = 16838;
// Margins: 1cm top/bottom (≈567 twips, near-minimum but print-safe), 2cm left/right.
const MARGIN_TOP_TWIPS = 567;
const MARGIN_BOTTOM_TWIPS = 567;
const MARGIN_SIDE_TWIPS = 1134;

const DOCUMENT_FONT = "Helvetica";
const TITLE_COLOR = "1A3D2E";
const FOOTER_BORDER_COLOR = "888888";

// Sizes in docx half-points (28pt → 56). The body size is computed per call.
const TITLE_HALF_PT = 56; // 28pt
const FOOTER_HALF_PT = 24; // 12pt

// Spacing in twips (1pt = 20 twips).
const TITLE_SPACING_AFTER = 240; // 12pt
const FOOTER_SPACING_BEFORE = 160; // 8pt

export function formatTotalDuration(totalMs: number): string {
  const totalMin = Math.floor(totalMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function slugifyTitle(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug.length > 0 ? slug : "setlist";
}

export function setlistFilename(playlistTitle: string): string {
  return `setlist-${slugifyTitle(playlistTitle)}.docx`;
}

function titleParagraph(title: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: TITLE_SPACING_AFTER },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: TITLE_HALF_PT,
        color: TITLE_COLOR,
        font: DOCUMENT_FONT,
      }),
    ],
  });
}

function trackParagraph(
  track: Track,
  opts: { bodyHalfPt: number; lineHeightTwips: number; keepNext: boolean },
): Paragraph {
  const num = String(track.position).padStart(2, "0");
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    // EXACT line rule: the `line` value is literally the line height in twips
    // (= fontSize × lineHeightFactor × 20). With AUTO, Word multiplies our
    // factor by the font's intrinsic single-line height (~1.15×), inflating
    // the actual rendered height by ~15% and pushing content off the page.
    // Zero before/after to also suppress Word's Normal-style 8pt "after".
    spacing: {
      before: 0,
      after: 0,
      line: opts.lineHeightTwips,
      lineRule: LineRuleType.EXACT,
    },
    keepNext: opts.keepNext,
    children: [
      new TextRun({
        text: `${num}. ${track.title}`,
        size: opts.bodyHalfPt,
        font: DOCUMENT_FONT,
      }),
    ],
  });
}

function footerParagraph(totalMs: number): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: FOOTER_SPACING_BEFORE },
    // Glue the footer to the last track: paired with keepNext on the last
    // track paragraph, this guarantees they render on the same page.
    keepLines: true,
    border: {
      top: { style: BorderStyle.SINGLE, size: 6, color: FOOTER_BORDER_COLOR, space: 4 },
    },
    children: [
      new TextRun({
        text: `Duración total: ${formatTotalDuration(totalMs)}`,
        italics: true,
        size: FOOTER_HALF_PT,
        font: DOCUMENT_FONT,
      }),
    ],
  });
}

export async function buildSetlist(playlist: Playlist): Promise<Buffer> {
  const { fontSizePt, lineHeightFactor } = computeBodyLayout(playlist.tracks.length);
  const bodyHalfPt = Math.round(fontSizePt * 2);
  // EXACT line height in twips: 1pt = 20 twips → line = fontSize × factor × 20.
  const lineHeightTwips = Math.round(fontSizePt * lineHeightFactor * 20);

  const lastIndex = playlist.tracks.length - 1;
  const trackParagraphs = playlist.tracks.map((t, i) =>
    trackParagraph(t, {
      bodyHalfPt,
      lineHeightTwips,
      keepNext: i === lastIndex,
    }),
  );

  const body: Paragraph[] = [
    titleParagraph(playlist.title),
    ...trackParagraphs,
    footerParagraph(playlist.totalDurationMs),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: DOCUMENT_FONT },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: A4_WIDTH_TWIPS,
              height: A4_HEIGHT_TWIPS,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: MARGIN_TOP_TWIPS,
              bottom: MARGIN_BOTTOM_TWIPS,
              left: MARGIN_SIDE_TWIPS,
              right: MARGIN_SIDE_TWIPS,
              // Zero out the implicit header/footer reservation Word adds
              // inside the top/bottom margins.
              header: 0,
              footer: 0,
              gutter: 0,
            },
          },
        },
        children: body,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
