// All measurements in PostScript points (pt). 1cm ≈ 28.346pt.
const A4_HEIGHT_PT = 842;
const ONE_CM_PT = 28.346;
// 1cm top + 1cm bottom margins → ~785pt usable height per page.
export const USABLE_HEIGHT_PT = A4_HEIGHT_PT - 2 * ONE_CM_PT;

export const DEFAULT_LINE_HEIGHT_FACTOR = 1.2; // single line spacing in docx terms

// Title block: 28pt × 1.2 line factor + 12pt spacing after ≈ 46pt.
// Subtracted ONCE from page 1 only.
export const TITLE_BLOCK_PT = 28 * DEFAULT_LINE_HEIGHT_FACTOR + 12;
// Footer block: 12pt × 1.2 line factor + 8pt spacing before ≈ 22pt.
// Subtracted ONCE from the last page only — the footer is glued to the last
// track via keepNext downstream.
export const FOOTER_BLOCK_PT = 12 * DEFAULT_LINE_HEIGHT_FACTOR + 8;

const PREFERRED_MIN_BODY_PT = 18; // soft minimum for primary search
const MIN_BODY_PT = 14; // hard floor (used by relaxed retry)
const MAX_BODY_PT = 28;
const MAX_PAGE_SEARCH = 200;

// Cap on Phase-2 line spacing expansion. Beyond this, the page looks like a
// list with empty rows between items.
const MAX_LINE_HEIGHT_FACTOR = 2.4;

// "Filled enough" — used to decide whether to retry with one fewer page when
// the chosen layout leaves a half-empty last page.
const FILL_RATIO_THRESHOLD = 0.85;

/**
 * Total available body height across `pages`. Title is subtracted once
 * (page 1), footer is subtracted once (last page) — intermediate pages
 * contribute their full USABLE_HEIGHT_PT.
 */
function totalBudget(pages: number): number {
  return USABLE_HEIGHT_PT * pages - TITLE_BLOCK_PT - FOOTER_BLOCK_PT;
}

function floorHalfPt(value: number): number {
  // Floor to nearest 0.5pt — never round up, so the chosen font is guaranteed
  // not to overflow `trackCount × fontSize × lineHeightFactor ≤ totalBudget`.
  return Math.floor(value * 2) / 2;
}

function floorToTwentieth(value: number): number {
  // Floor to nearest 0.05. Mirrors floorHalfPt — never round up, otherwise
  // `trackCount × MAX_BODY_PT × lineHeightFactor` can overflow the page budget
  // by a fraction of a point and push a track to a phantom 2nd page.
  return Math.floor(value * 20) / 20;
}

function fillRatioForChoice(
  trackCount: number,
  fontSizePt: number,
  lineHeightFactor: number,
  pageCount: number,
): number {
  const contentHeight = trackCount * fontSizePt * lineHeightFactor;
  const totalContent = contentHeight + TITLE_BLOCK_PT + FOOTER_BLOCK_PT;
  return totalContent / (USABLE_HEIGHT_PT * pageCount);
}

/**
 * Picks body font size + line spacing + page count so the tracklist fills its
 * pages without leaving a half-empty last page.
 *
 * Phase 1 — primary search at default 1.2 line spacing:
 *   For pageCount = 1, 2, 3, …, compute the exact-fit font size from the
 *   total multi-page budget. The first pageCount whose exact-fit lands in
 *   [PREFERRED_MIN, MAX] wins. Floor to 0.5pt (never round up — that would
 *   overflow by a fraction of a point and push one line onto an extra page).
 *
 *   When exact-fit at the chosen pageCount > MAX, the setlist is shorter
 *   than the page budget at default spacing:
 *     - At pageCount === 1 → Phase 2 (line-spacing expansion).
 *     - At pageCount > 1   → cap the font at MAX. If the resulting fill
 *                            ratio is below FILL_RATIO_THRESHOLD, retry
 *                            with pageCount − 1 under a relaxed minimum
 *                            of MIN_BODY_PT (14pt). This catches the
 *                            "borderline" case where Phase 1 jumped one
 *                            page too soon because of the soft 18pt floor.
 *
 * Phase 2 — short setlist that even maxed-out font can't fill on one page:
 *   Keep font at MAX (28pt) and expand lineHeightFactor to fill the page.
 *   lineHeightFactor is clamped at MAX_LINE_HEIGHT_FACTOR to avoid an
 *   "empty rows between titles" look.
 */
export function computeBodyLayout(trackCount: number): {
  fontSizePt: number;
  lineHeightFactor: number;
  pageCount: number;
} {
  if (trackCount <= 0) {
    return {
      fontSizePt: PREFERRED_MIN_BODY_PT,
      lineHeightFactor: DEFAULT_LINE_HEIGHT_FACTOR,
      pageCount: 1,
    };
  }

  for (let pages = 1; pages <= MAX_PAGE_SEARCH; pages++) {
    const budget = totalBudget(pages);
    const exactFit = budget / (trackCount * DEFAULT_LINE_HEIGHT_FACTOR);

    // Setlist too long for this pageCount at our preferred minimum — try more pages.
    if (exactFit < PREFERRED_MIN_BODY_PT) continue;

    // Setlist too short for this pageCount at default spacing.
    if (exactFit > MAX_BODY_PT) {
      if (pages === 1) {
        // Phase 2: line-spacing expansion on a single page.
        const exactFactor = budget / (trackCount * MAX_BODY_PT);
        return {
          fontSizePt: MAX_BODY_PT,
          lineHeightFactor: floorToTwentieth(Math.min(exactFactor, MAX_LINE_HEIGHT_FACTOR)),
          pageCount: 1,
        };
      }
      // pageCount > 1: cap at MAX. Retry pageCount − 1 with relaxed minimum
      // if the cap leaves the last page too empty.
      const cappedFill = fillRatioForChoice(trackCount, MAX_BODY_PT, DEFAULT_LINE_HEIGHT_FACTOR, pages);
      if (cappedFill < FILL_RATIO_THRESHOLD) {
        const prevPages = pages - 1;
        const prevBudget = totalBudget(prevPages);
        const prevExactFit = prevBudget / (trackCount * DEFAULT_LINE_HEIGHT_FACTOR);
        if (prevExactFit >= MIN_BODY_PT && prevExactFit <= MAX_BODY_PT) {
          const prevFont = floorHalfPt(prevExactFit);
          if (prevFont * trackCount * DEFAULT_LINE_HEIGHT_FACTOR <= prevBudget) {
            return {
              fontSizePt: prevFont,
              lineHeightFactor: DEFAULT_LINE_HEIGHT_FACTOR,
              pageCount: prevPages,
            };
          }
        }
      }
      return {
        fontSizePt: MAX_BODY_PT,
        lineHeightFactor: DEFAULT_LINE_HEIGHT_FACTOR,
        pageCount: pages,
      };
    }

    // exactFit ∈ [PREFERRED_MIN, MAX]: floor to 0.5pt.
    return {
      fontSizePt: floorHalfPt(exactFit),
      lineHeightFactor: DEFAULT_LINE_HEIGHT_FACTOR,
      pageCount: pages,
    };
  }

  // Absurd track count fallback.
  return {
    fontSizePt: MIN_BODY_PT,
    lineHeightFactor: DEFAULT_LINE_HEIGHT_FACTOR,
    pageCount: MAX_PAGE_SEARCH,
  };
}
