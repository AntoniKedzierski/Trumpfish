import { useEffect, useState } from 'react';
import { listFriends } from '@/api/friends';
import type { FriendSummary, SavedDealSummary } from '@/api/models';
import { getDealShares, setDealShares } from '@/api/savedDeals';
import { CheckIcon, CloseIcon } from '@/components/icons';
import './savedDeals.css';

/**
 * Who a deal is shared with. The dialog opens on what is already true and hands back the whole set, so taking somebody
 * off the list is the same gesture as putting somebody on it.
 */
/*
 * Only friends: a deal carries somebody's own remarks, and the list of people it can be handed to is the list of people
 * he has already agreed to be known by. The server checks the same thing - this is the convenience, not the rule.
 */
export function ShareDealDialog({ deal, onClose }: { deal: SavedDealSummary; onClose: () => void }) {
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([listFriends(), getDealShares(deal.id)]).then(
      ([view, shared]) => {
        if (!cancelled) {
          setFriends(view.friends ?? []);
          setChosen(new Set(shared));
          setLoading(false);
        }
      },
      (reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setLoading(false);
        }
      },
    );

    return () => { cancelled = true; };
  }, [deal.id]);

  // Escape is the way out of every other panel in the application, so it is the way out of this one.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const toggle = (userId: string) => {
    setChosen((current) => {
      const next = new Set(current);
      if (!next.delete(userId)) {
        next.add(userId);
      }

      return next;
    });
  };

  const share = () => {
    setBusy(true);
    setError(null);
    setDealShares(deal.id, [...chosen])
      .then(onClose)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="save-deal-backdrop" role="presentation" onClick={onClose}>
      <div className="save-deal-dialog" role="dialog" aria-modal="true" aria-labelledby="share-deal-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="share-deal-title">Komu udostępnić?</h2>
        <p className="saved-remove-text">„{deal.name}” zobaczą wybrani znajomi na swojej liście udostępnionych rozdań.</p>

        {loading ? <p className="saved-remove-text">Wczytuję znajomych…</p> : null}

        {loading || friends.length > 0 ? null : (
          <p className="saved-remove-text">Nie masz jeszcze znajomych. Zaproś kogoś z paska u góry.</p>
        )}

        {friends.length === 0 ? null : (
          <div className="share-deal-list">
            {friends.map((friend) => (
              <label key={friend.userId} className="share-deal-friend">
                <input type="checkbox" checked={chosen.has(friend.userId)} disabled={busy} onChange={() => toggle(friend.userId)} />
                <span>{friend.displayName ?? friend.username}</span>
              </label>
            ))}
          </div>
        )}

        {error === null ? null : <p className="save-deal-error">{error}</p>}

        <div className="save-deal-actions">
          <button type="button" className="small" disabled={busy} onClick={onClose}>
            <CloseIcon />
            <span>Odrzuć</span>
          </button>
          <button type="button" className="small primary" disabled={busy || loading} onClick={share}>
            <CheckIcon />
            <span>{busy ? 'Zapisuję…' : 'Udostępnij'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
