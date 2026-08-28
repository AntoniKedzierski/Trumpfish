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
export type CardColor = Schemas['CardColor'];
export type CardValue = Schemas['CardValue'];
export type PlayerPosition = Schemas['PlayerPosition'];
export type SimulationCard = Schemas['SimulationCard'];
export type SimulationHand = Schemas['SimulationHand'];
export type SimulationBid = Schemas['SimulationBid'];
export type SimulationContract = Schemas['SimulationContract'];
export type SimulationDealRequest = Schemas['SimulationDealRequest'];
export type SimulationDealResult = Schemas['SimulationDealResult'];
export type SimulationRequest = Schemas['SimulationRequest'];
export type SimulationResponse = Schemas['SimulationResponse'];

export const bidColors: readonly BidColor[] = ['NoColor', 'Clubs', 'Diamonds', 'Hearts', 'Spades', 'NoTrump'];

export const bidTypes: readonly BidType[] = ['Pass', 'Submit', 'Double', 'Redouble'];

export const playerPositions: readonly PlayerPosition[] = ['North', 'East', 'South', 'West'];

export const cardColors: readonly CardColor[] = ['Clubs', 'Diamonds', 'Hearts', 'Spades'];

export const cardValues: readonly CardValue[] = ['Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King', 'Ace'];

/** The generated models widen integral properties to `number | string`, so unwrap them before doing arithmetic or feeding an input. */
export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}
