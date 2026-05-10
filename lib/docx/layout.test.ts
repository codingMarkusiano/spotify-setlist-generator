import { describe, expect, it } from "vitest";
import {
  computeBodyLayout,
  FOOTER_BLOCK_PT,
  TITLE_BLOCK_PT,
  USABLE_HEIGHT_PT,
} from "./layout.ts";

const FILL_RATIO_THRESHOLD = 0.85;

function fillRatio(
  trackCount: number,
  r: { fontSizePt: number; lineHeightFactor: number; pageCount: number },
): number {
  const contentHeight = trackCount * r.fontSizePt * r.lineHeightFactor;
  const totalContent = contentHeight + TITLE_BLOCK_PT + FOOTER_BLOCK_PT;
  return totalContent / (USABLE_HEIGHT_PT * r.pageCount);
}

describe("computeBodyLayout", () => {
  // Bug regression: 26 tracks must land on a single page. Previously the
  // layout rounded the font up by 0.5pt, overflowing the page budget by ~0.6pt
  // and pushing the last line onto a second, mostly empty page.
  it("26 tracks fits on a single page (regression)", () => {
    expect(computeBodyLayout(26).pageCount).toBe(1);
  });

  it("empty playlist: 18pt at default 1.2 spacing on 1 page", () => {
    expect(computeBodyLayout(0)).toEqual({
      fontSizePt: 18,
      lineHeightFactor: 1.2,
      pageCount: 1,
    });
  });

  it("1 track: 28pt, line factor clamped at 2.4, 1 page", () => {
    expect(computeBodyLayout(1)).toEqual({
      fontSizePt: 28,
      lineHeightFactor: 2.4,
      pageCount: 1,
    });
  });

  it("5 tracks: 28pt, line factor expanded (between 1.2 and 2.4), 1 page", () => {
    const r = computeBodyLayout(5);
    expect(r.fontSizePt).toBe(28);
    expect(r.lineHeightFactor).toBeGreaterThan(1.2);
    expect(r.lineHeightFactor).toBeLessThanOrEqual(2.4);
    expect(r.pageCount).toBe(1);
  });

  it("8 tracks: 28pt, line factor still expanded but no greater than 5-track case", () => {
    const r = computeBodyLayout(8);
    const r5 = computeBodyLayout(5);
    expect(r.fontSizePt).toBe(28);
    expect(r.lineHeightFactor).toBeGreaterThan(1.2);
    expect(r.lineHeightFactor).toBeLessThanOrEqual(2.4);
    expect(r.lineHeightFactor).toBeLessThanOrEqual(r5.lineHeightFactor);
    expect(r.pageCount).toBe(1);
  });

  it("around the 28pt-fits-1.2 threshold (~21 tracks): 28pt, line factor near 1.2", () => {
    const r = computeBodyLayout(21);
    expect(r.fontSizePt).toBe(28);
    expect(r.lineHeightFactor).toBeGreaterThanOrEqual(1.2);
    expect(r.lineHeightFactor).toBeLessThan(1.5);
    expect(r.pageCount).toBe(1);
  });

  it("under-cap medium (25 tracks): font < 28pt, line factor stays 1.2 on 1 page", () => {
    const r = computeBodyLayout(25);
    expect(r.fontSizePt).toBeLessThan(28);
    expect(r.fontSizePt).toBeGreaterThanOrEqual(18);
    expect(r.lineHeightFactor).toBe(1.2);
    expect(r.pageCount).toBe(1);
  });

  it("naturally-full and longer playlists keep line factor at 1.2", () => {
    for (const n of [25, 40, 60, 120, 500]) {
      const r = computeBodyLayout(n);
      expect(r.lineHeightFactor).toBe(1.2);
      expect(r.fontSizePt).toBeGreaterThanOrEqual(18);
      expect(r.fontSizePt).toBeLessThanOrEqual(28);
      expect(r.pageCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("font size rounds (floored) to nearest 0.5pt", () => {
    for (const n of [22, 25, 30, 50, 100]) {
      const { fontSizePt } = computeBodyLayout(n);
      expect(fontSizePt * 2).toBe(Math.round(fontSizePt * 2));
    }
  });

  it("line height factor rounds to nearest 0.05", () => {
    for (const n of [11, 12, 14, 17, 19]) {
      const { lineHeightFactor } = computeBodyLayout(n);
      const twentyX = lineHeightFactor * 20;
      expect(Math.abs(twentyX - Math.round(twentyX))).toBeLessThan(1e-9);
    }
  });

  it("page count is monotonically non-decreasing as tracks grow", () => {
    let prev = 0;
    for (const n of [1, 22, 35, 60, 100, 200, 500]) {
      const pc = computeBodyLayout(n).pageCount;
      expect(pc).toBeGreaterThanOrEqual(prev);
      prev = pc;
    }
  });

  // Parametrised invariant: the chosen layout must fill ≥ 85% of its budget.
  // No half-empty last pages allowed.
  //
  // Exception: very short setlists (≤10 tracks) hit the 2.4 line-height clamp
  // and intentionally underfill — the user accepted that tradeoff to avoid an
  // "empty rows between titles" look.
  describe("fill-ratio invariant (5..200 sweep)", () => {
    const isPhase2Clamped = (r: { fontSizePt: number; lineHeightFactor: number }) =>
      r.fontSizePt === 28 && r.lineHeightFactor === 2.4;

    for (let n = 5; n <= 200; n++) {
      it(`${n} tracks → fill ratio ≥ ${FILL_RATIO_THRESHOLD}`, () => {
        const r = computeBodyLayout(n);
        if (isPhase2Clamped(r)) return;
        expect(fillRatio(n, r)).toBeGreaterThanOrEqual(FILL_RATIO_THRESHOLD);
      });
    }
  });

  it("never overflows: chosen font × tracks × lineHeight ≤ budget", () => {
    for (let n = 1; n <= 500; n++) {
      const r = computeBodyLayout(n);
      const contentHeight = n * r.fontSizePt * r.lineHeightFactor;
      const budget = USABLE_HEIGHT_PT * r.pageCount - TITLE_BLOCK_PT - FOOTER_BLOCK_PT;
      // Allow tiny float epsilon at the boundary.
      expect(contentHeight).toBeLessThanOrEqual(budget + 1e-9);
    }
  });
});
