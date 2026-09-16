import type { components } from './schema';

type Schemas = components['schemas'];

/**
 * Every model below is generated from the ASP.NET Core OpenAPI document (see `npm run generate:api`).
 * The C# types in the shared `Model` project are the single source of truth - never edit `schema.d.ts` by hand.
 */
export type BiddingSystem = Schemas['BiddingSystem'];
export type BiddingSystemSummary = Schemas['BiddingSystemSummary'];
export type CurrentUser = Schemas['CurrentUser'];
export type LoginRequest = Schemas['LoginRequest'];
export type RegisterRequest = Schemas['RegisterRequest'];
export type ChangePasswordRequest = Schemas['ChangePasswordRequest'];
export type UpdateProfileRequest = Schemas['UpdateProfileRequest'];
export type RenameSystemRequest = Schemas['RenameSystemRequest'];
export type SaveSystemRequest = Schemas['SaveSystemRequest'];
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
export type Pair = Schemas['Pair'];
export type Vulnerability = Schemas['Vulnerability'];
export type DoubleDummyRequest = Schemas['DoubleDummyRequest'];
export type DoubleDummyResponse = Schemas['DoubleDummyResponse'];
export type DoubleDummyContract = Schemas['DoubleDummyContract'];
export type DoubleDummyBestContract = Schemas['DoubleDummyBestContract'];
export type DoubleDummyBid = Schemas['DoubleDummyBid'];
export type DoubleDummyCell = Schemas['DoubleDummyCell'];
export type DoubleDummyPlayed = Schemas['DoubleDummyPlayed'];
export type DoubleDummyDifference = Schemas['DoubleDummyDifference'];
export type BiddingMiss = Schemas['BiddingMiss'];
export type DoubleDummyInfo = Schemas['DoubleDummyInfo'];
export type SaveDealRequest = Schemas['SaveDealRequest'];
export type SavedDealPage = Schemas['SavedDealPage'];
export type SharedDealPage = Schemas['SharedDealPage'];
export type SharedDealSummary = Schemas['SharedDealSummary'];
export type SavedDealSummary = Schemas['SavedDealSummary'];
export type UpdateSavedDealRequest = Schemas['UpdateSavedDealRequest'];
export type SavedDealTag = Schemas['SavedDealTag'];
export type SimulationCard = Schemas['SimulationCard'];
export type SimulationHand = Schemas['SimulationHand'];
export type SimulationBid = Schemas['SimulationBid'];
export type SimulationContract = Schemas['SimulationContract'];
export type SimulationDealRequest = Schemas['SimulationDealRequest'];
export type SimulationDealResult = Schemas['SimulationDealResult'];
export type SimulationRequest = Schemas['SimulationRequest'];
export type SimulationResponse = Schemas['SimulationResponse'];
export type PracticeRole = Schemas['PracticeRole'];
export type PracticeStartRequest = Schemas['PracticeStartRequest'];
export type PracticeBidRequest = Schemas['PracticeBidRequest'];
export type PracticeLegalBids = Schemas['PracticeLegalBids'];
export type PracticeState = Schemas['PracticeState'];
export type PracticeWarning = Schemas['PracticeWarning'];
export type PracticeHint = Schemas['PracticeHint'];
export type FriendPresence = Schemas['FriendPresence'];
export type FriendshipState = Schemas['FriendshipState'];
export type FriendSummary = Schemas['FriendSummary'];
export type FriendsView = Schemas['FriendsView'];
export type DuoSettings = Schemas['DuoSettings'];
export type DuoInvitation = Schemas['DuoInvitation'];
export type DuoSeat = Schemas['DuoSeat'];
export type DuoTableState = Schemas['DuoTableState'];

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

const cardLabels: Record<string, string> = {
  Two: '2',
  Three: '3',
  Four: '4',
  Five: '5',
  Six: '6',
  Seven: '7',
  Eight: '8',
  Nine: '9',
  Ten: '10',
  Jack: 'J',
  Queen: 'Q',
  King: 'K',
  Ace: 'A',
};

const suitMarks: Record<CardColor, string> = { Clubs: '♣', Diamonds: '♦', Hearts: '♥', Spades: '♠' };

export function cardLabel(card: Pick<SimulationCard, 'value' | 'color'>): string {
  return `${cardLabels[card.value] ?? card.value}${suitMarks[card.color]}`;
}

/** Single letter seat labels, as a bridge diagram writes them. */
export const positionLabels: Record<PlayerPosition, string> = { North: 'N', East: 'E', South: 'S', West: 'W' };
