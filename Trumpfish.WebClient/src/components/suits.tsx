import type { BidColor } from '@/api/models';
import './suits.css';

/**
 * The suit marks, drawn rather than typed.
 *
 * `♠ ♥ ♦ ♣` are emoji-presentation characters on iOS: the system substitutes its own colour glyphs, which ignore `color`
 * entirely, so the marks came out as pictures in fixed hues and the tinting did nothing. Paths filled with `currentColor`
 * render identically on every platform and take the suit colour the way the rest of the interface expects.
 *
 * Every `viewBox` below is trimmed to the drawing's own bounding box - no margin around the pip. That is what lets the
 * stylesheet say "this tall" and get a mark exactly that tall, instead of one that sits somewhere inside a padded square
 * and comes out short and high. The heights, and the baseline they sit on, are set in `suits.css`.
 *
 * No-trump, double and redouble are lettering rather than pips, so they are stroked instead of filled, and their boxes are
 * wider - two letters need the room that one pip does not.
 */

const suitNames: Record<BidColor, string> = {
  Clubs: 'trefl',
  Diamonds: 'karo',
  Hearts: 'kier',
  Spades: 'pik',
  NoTrump: 'bez atu',
  NoColor: '',
};

/** Lettering geometry, shared so the letters cannot drift apart in weight. */
const letter = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/*
 * No-trump is written a step lighter than the double and the redouble.
 *
 * Those two stand alone in a cell; `NT` stands against a digit, every time it is drawn, and at the double's weight it read
 * as bold lettering beside a regular one. The stroke here is what a digit's stem measures at the same size.
 */
const noTrumpLetter = { ...letter, strokeWidth: 2.35 } as const;

/*
 * Every suit mark renders in the same square box, at the same size, whatever it is drawing.
 *
 * The drawings themselves are not the same shape - a spade is tall and narrow, a heart short and wide - so trimming each
 * viewBox to its own drawing gave five boxes of five different proportions, and the size they came out at then depended
 * on how the surrounding layout resolved an intrinsic aspect ratio. That is the wobble.
 *
 * So the box is fixed at 24 by 24 for all of them and the drawing is fitted into it here instead: scaled until its ink is
 * `suitInk` tall, centred across, and stood on the bottom edge. The ink is then exactly the same height in every mark, the
 * element is exactly the same width and height in every mark, and nothing is left for a layout to interpret. A drawing
 * narrower than the box simply has air either side of it, which is what the air is for.
 *
 * Standing the ink on the bottom edge rather than centring it is what lets the mark align. The element's bottom edge is
 * what inline layout puts on the baseline, so ink flush with that edge stands on the baseline exactly, and the stylesheet
 * needs no correction to stand it there - which matters, because a correction stated in `em` lands on a fraction of a
 * pixel and the engine rounds it differently from one row to the next.
 *
 * The share of the box the ink takes is the other half of the same argument. The element is exactly one em square (see
 * `--mark-box`), so that it measures a whole number of pixels wherever it appears; the drawing is then the fraction of
 * that square a capital letter would be. Were it the drawing that were stated in em and the box derived from it, the box
 * would be the thing landing on a fraction, and a box rounded a pixel taller reads as a mark sitting a pixel high.
 */
const suitBox = 24;

/** 78 per cent of the box, which is where the marks were tuned to. The air it leaves all sits above the drawing. */
const suitInk = suitBox * 0.78;

/*
 * The lettering stands at the text's own cap height instead, which is the smaller of the two.
 *
 * A pip is a round shape and is drawn a shade taller than a capital, the way a typeface overshoots an O. Two letters are
 * not round, so given the pips' height they simply came out bigger than the digit beside them - and the digit is the one
 * thing a bid's mark has to match.
 */
const letterInk = suitBox * 0.72;

/** The drawn extent of each mark, measured off its paths: x, y, width, height. */
type Ink = readonly [number, number, number, number];

function fit([x, y, width, height]: Ink, tall: number): string {
  const scale = tall / height;
  const dx = suitBox / 2 - (x + width / 2) * scale;
  const dy = suitBox - (y + height) * scale;
  return `translate(${round(dx)} ${round(dy)}) scale(${round(scale)})`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function Glyph({ ink, tall = suitInk, label, className, children }: { ink: Ink; tall?: number; label: string; className?: string; children: React.ReactNode }) {
  return (
    <span className={className === undefined ? 'mark' : `mark ${className}`}>
      <svg className="mark-svg" viewBox={`0 0 ${suitBox} ${suitBox}`} aria-hidden="true" focusable="false">
        <g transform={fit(ink, tall)}>{children}</g>
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** The double and the redouble keep their own proportions; they are lettering, and the user is happy with them as they are. */
function CallGlyph({ viewBox, label, className, children }: { viewBox: string; label: string; className?: string; children: React.ReactNode }) {
  const [, , width, height] = viewBox.split(' ').map(Number);

  return (
    <span className={`mark mark-call${className === undefined ? '' : ` ${className}`}`}>
      <svg
        className="mark-svg"
        viewBox={viewBox}
        style={{ '--mark-aspect': width / height } as React.CSSProperties}
        aria-hidden="true"
        focusable="false"
      >
        {children}
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * One denomination. `className` carries the tint - `suit hearts` and the like - so the colour still comes from the one
 * place it always came from.
 */
export function SuitMark({ suit, className }: { suit: BidColor; className?: string }) {
  const tint = className ?? `suit ${suit.toLowerCase()}`;
  const label = suitNames[suit];

  switch (suit) {
    case 'Spades':
      return (
        <Glyph label={label} className={tint} ink={[4, 2.2, 16, 19.6]}>
          <path
            d="M12 2.2c-1.9 2.3-8 7.1-8 11.5 0 2.7 2 4.6 4.4 4.6 1.2 0 2.2-.5 2.9-1.3-.2 1.9-.9 3.6-2.4 4.8h6.2c-1.5-1.2-2.2-2.9-2.4-4.8.7.8 1.7 1.3 2.9 1.3 2.4 0 4.4-1.9 4.4-4.6 0-4.4-6.1-9.2-8-11.5Z"
            fill="currentColor"
          />
        </Glyph>
      );
    case 'Hearts':
      return (
        <Glyph label={label} className={tint} ink={[2.6, 3.9, 18.8, 17.7]}>
          <path
            d="M12 21.6C9.4 19.4 2.6 14.3 2.6 9.2 2.6 6.1 4.9 3.9 7.6 3.9c1.9 0 3.5 1.1 4.4 2.8.9-1.7 2.5-2.8 4.4-2.8 2.7 0 5 2.2 5 5.3 0 5.1-6.8 10.2-9.4 12.4Z"
            fill="currentColor"
          />
        </Glyph>
      );
    case 'Diamonds':
      return (
        <Glyph label={label} className={tint} ink={[3.6, 2.2, 16.8, 19.6]}>
          <path d="M12 2.2 20.4 12 12 21.8 3.6 12 12 2.2Z" fill="currentColor" />
        </Glyph>
      );
    case 'Clubs':
      /*
       * The stem starts at 10.4, above where the top lobe ends at 11.9, so the two overlap. Drawn to meet exactly, the
       * three lobes leave an uncovered wedge on the centre line - which is the notch that was showing between the top
       * lobe and the rest.
       */
      return (
        <Glyph label={label} className={tint} ink={[2.7, 3.3, 18.6, 18.5]}>
          <circle cx="12" cy="7.6" r="4.3" fill="currentColor" />
          <circle cx="7" cy="14.2" r="4.3" fill="currentColor" />
          <circle cx="17" cy="14.2" r="4.3" fill="currentColor" />
          <path d="M10.3 10.4c.35 4.7-.45 8.2-2.05 11.4h7.5c-1.6-3.2-2.4-6.7-2.05-11.4z" fill="currentColor" />
        </Glyph>
      );
    case 'NoTrump':
      /* Condensed, and only a little wider than a pip: two letters, not a word. The box allows for the stroke's own width. */
      return (
        <Glyph label={label} className={tint} ink={[2.025, 3.825, 18.75, 16.35]} tall={letterInk}>
          <path d="M3.2 19V5l6.6 14V5" {...noTrumpLetter} />
          <path d="M12.4 5.4h7.2M16 5.4V19" {...noTrumpLetter} />
        </Glyph>
      );
    default:
      return null;
  }
}

/** Kontra. Left at its own size and centred on the text rather than stood on the baseline - it is a mark, not a pip. */
export function DoubleMark({ className }: { className?: string }) {
  return (
    <CallGlyph label="kontra" className={className} viewBox="0 0 24 24">
      <path d="M6.4 5.4 17.6 18.6M17.6 5.4 6.4 18.6" {...letter} />
    </CallGlyph>
  );
}

/** Rekontra. */
export function RedoubleMark({ className }: { className?: string }) {
  return (
    <CallGlyph label="rekontra" className={className} viewBox="0 0 30 24">
      <path d="M2.6 5.4 12.4 18.6M12.4 5.4 2.6 18.6" {...letter} />
      <path d="M17.6 5.4 27.4 18.6M27.4 5.4 17.6 18.6" {...letter} />
    </CallGlyph>
  );
}
