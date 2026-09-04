import type { PracticeWarning } from '@/api/models';
import { BidLabel } from '@/features/simulation/components/DealViews';

/**
 * What the player told his partner, set against the hand he is actually holding. Raised only for bids the system cannot square
 * with that hand - either because it does not have the bid there at all, or because it has it under conditions this hand misses.
 */
export function BidWarning({ warnings }: { warnings: readonly PracticeWarning[] }) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <section className="warning" role="status">
      <h2>{warnings.length === 1 ? 'Odzywka nie pasuje do ręki' : 'Odzywki nie pasujące do ręki'}</h2>

      {warnings.map((warning) => (
        <dl key={warning.bidIndex}>
          <dt>Twoja odzywka</dt>
          <dd>
            <strong><BidLabel bid={warning.bid} /></strong>
            {warning.promised === null || warning.promised === undefined
              ? ' — tej odzywki system nie przewiduje w tym miejscu licytacji.'
              : ` — ${warning.promised}`}
          </dd>

          {warning.suggested === null || warning.suggested === undefined ? null : (
            <>
              <dt>Silnik</dt>
              <dd>
                <strong><BidLabel bid={warning.suggested} /></strong>
                {warning.suggestedMeaning === null || warning.suggestedMeaning === undefined ? null : ` — ${warning.suggestedMeaning}`}
              </dd>
            </>
          )}
        </dl>
      ))}
    </section>
  );
}
