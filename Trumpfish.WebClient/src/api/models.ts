import type { components } from './schema';

type Schemas = components['schemas'];

/**
 * Every model below is generated from the ASP.NET Core OpenAPI document (see `npm run generate:api`).
 * The C# types in the shared `Model` project are the single source of truth - never edit `schema.d.ts` by hand.
 */
export type BiddingSystem = Schemas['BiddingSystem'];
export type BiddingSystemSummary = Schemas['BiddingSystemSummary'];
export type Root = Schemas['Root'];
export type BidNode = Schemas['BidNode'];
export type NumberRange = Schemas['NumberRange'];
export type ValidationIssue = Schemas['ValidationIssue'];
export type ValidationSeverity = Schemas['ValidationSeverity'];
export type BidColor = Schemas['BidColor'];
export type BidType = Schemas['BidType'];

export const bidColors: readonly BidColor[] = ['NoColor', 'Clubs', 'Diamonds', 'Hearts', 'Spades', 'NoTrump'];

export const bidTypes: readonly BidType[] = ['Pass', 'Submit', 'Double', 'Redouble'];

/** The generated models widen integral properties to `number | string`, so unwrap them before doing arithmetic or feeding an input. */
export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}
