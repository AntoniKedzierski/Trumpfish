import { toNumber, type NumberRange } from '@/api/models';
import { rangeFields, type InheritedRange, type InheritedRanges, type RangeField } from './constraints';

/** Which field each suit marker fills. Suits are told apart by the first two letters of the word, as descriptions write them. */
const suitFields: Record<'tr' | 'ka' | 'ki' | 'pi', RangeField> = {
  tr: 'clubsCardRange',
  ka: 'diamondsCardRange',
  ki: 'heartsCardRange',
  pi: 'spadesCardRange',
};

type SuitMarker = keyof typeof suitFields;
type Bounds = { lower: number | null; upper: number | null };

/**
 * `ka` must not swallow "kart", "kartowy" or "karty": those count cards rather than name diamonds, and they sit in exactly the
 * position a suit would ("4+ kartowy fit" is a four card fit). All three start with "kart", so one lookahead rules them out.
 */
const suitMarkers = String.raw`tr|ka(?!rt)|ki|pi`;

/** Point ranges are written with a hyphen about as often as with a dash. */
const dash = String.raw`[-–—]`;

const pointsPatterns: { pattern: RegExp; read: (match: RegExpExecArray) => NumberRange }[] = [
  { pattern: new RegExp(String.raw`(\d+)\s*${dash}\s*(\d+)\s*pc\b`, 'i'), read: (match) => ({ lower: Number(match[1]), upper: Number(match[2]) }) },
  { pattern: /(\d+)\s*\+\s*pc\b/i, read: (match) => ({ lower: Number(match[1]), upper: null }) },
  // "Poniżej N PC" names the bound rather than excluding it: it means N or fewer, not N-1 or fewer.
  { pattern: /poni[żz]ej\s+(\d+)\s*pc\b/i, read: (match) => ({ lower: null, upper: Number(match[1]) }) },
];

const suitPatterns: { pattern: RegExp; read: (count: number) => Partial<Bounds> }[] = [
  { pattern: new RegExp(String.raw`(\d+)\s*\+\s*(${suitMarkers})`, 'gi'), read: (count) => ({ lower: count }) },
  { pattern: new RegExp(String.raw`brak\s+(\d+)\s*(${suitMarkers})`, 'gi'), read: (count) => ({ upper: Math.max(0, count - 1) }) },
  { pattern: new RegExp(String.raw`dok[łl]adnie\s+(\d+)\s*(${suitMarkers})`, 'gi'), read: (count) => ({ lower: count, upper: count }) },
];

/**
 * Reads the point range and the suit lengths out of a bid's description, as a patch holding only what could actually be read.
 * Everything else on the bid is left alone, so running this again overwrites the facts it recognises and nothing more.
 *
 * The description is taken a comma separated section at a time; a section that matches nothing is simply skipped, which is what
 * lets the prose that surrounds the numbers ("blokujące", "ręka zrównoważona") sit there untouched.
 *
 * A range that comes out exactly as the player already promised it is dropped: writing it again would state explicitly what the
 * sequence already implies, and the editor shows it as a placeholder either way.
 */
export function readCondition(text: string, inherited: InheritedRanges): Partial<Record<RangeField, NumberRange>> {
  const found: Partial<Record<RangeField, NumberRange>> = {};
  const suits = new Map<SuitMarker, Bounds>();

  for (const section of text.split(',')) {
    // Points are written once, at the front, so the first section that yields them wins.
    if (found.pointsRange === undefined) {
      const points = readPoints(section);
      if (points !== null) {
        found.pointsRange = points;
      }
    }

    readSuits(section, suits);
  }

  for (const [marker, bounds] of suits) {
    found[suitFields[marker]] = bounds;
  }

  const patch: Partial<Record<RangeField, NumberRange>> = {};
  for (const field of rangeFields) {
    const range = found[field];
    if (range !== undefined && !repeatsInherited(range, inherited[field])) {
      patch[field] = range;
    }
  }

  return patch;
}

/** Whether a range says precisely what the ancestors already said, in which case restating it on this bid adds nothing. */
function repeatsInherited(range: NumberRange, inherited: InheritedRange | undefined): boolean {
  return inherited !== undefined && toNumber(range.lower) === inherited.lower && toNumber(range.upper) === inherited.upper;
}

function readPoints(section: string): NumberRange | null {
  for (const { pattern, read } of pointsPatterns) {
    const match = pattern.exec(section);
    if (match !== null) {
      return read(match);
    }
  }

  return null;
}

/**
 * Collects every suit length stated in one section. The bounds are merged rather than replaced, so a description that gives a
 * floor and a ceiling for the same suit in separate breaths ends up with both.
 */
function readSuits(section: string, into: Map<SuitMarker, Bounds>): void {
  for (const { pattern, read } of suitPatterns) {
    for (const match of section.matchAll(pattern)) {
      const marker = match[2].toLowerCase() as SuitMarker;
      const current = into.get(marker) ?? { lower: null, upper: null };
      into.set(marker, { ...current, ...read(Number(match[1])) });
    }
  }
}
