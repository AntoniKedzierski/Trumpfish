import { useEffect, useRef, useState } from 'react';
import { listMyDealTags } from '@/api/savedDeals';
import { CheckIcon, CloseIcon } from '@/components/icons';
import './savedDeals.css';

export interface DealDetails {
  name: string;
  tags: string;
  comment: string;
}

interface DealDetailsDialogProps {
  title: string;
  initial: DealDetails;
  /** What the confirming button says while it waits, and what it says the rest of the time. */
  submitLabel: string;
  busyLabel: string;
  /** Rejects with the message to show; resolving is taken as done and the dialog closes itself. */
  onSubmit: (details: DealDetails) => Promise<unknown>;
  onClose: () => void;
}

/**
 * The part of a saved deal only the user knows: what to call it, what to file it under, and anything worth saying.
 */
/*
 * One dialog for keeping a deal and for editing one already kept. The two ask exactly the same three questions, and two
 * copies of them would be two places for the tag field to behave differently.
 */
export function DealDetailsDialog({ title, initial, submitLabel, busyLabel, onSubmit, onClose }: DealDetailsDialogProps) {
  const [name, setName] = useState(initial.name);
  const [tags, setTags] = useState(initial.tags);
  const [comment, setComment] = useState(initial.comment);
  const [known, setKnown] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // The user's own keywords, fetched once as the dialog opens. There are never many, so the filtering is done here.
  useEffect(() => {
    let cancelled = false;
    listMyDealTags().then(
      (loaded) => { if (!cancelled) { setKnown(loaded.map((tag) => tag.tag)); } },
      () => undefined,
    );

    nameRef.current?.select();
    return () => { cancelled = true; };
  }, []);

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

  /*
   * Suggested against the word being typed rather than the whole field: tags are a list, and the one the user is in the
   * middle of is the only one he can still be helped with. Five of them, most used first - the list arrives in that order.
   */
  const typed = lastWord(tags).toLowerCase();
  const chosen = new Set(tags.toLowerCase().split(/[\s,;]+/).filter((tag) => tag !== ''));
  const suggestions = typed === '' ? [] : known.filter((tag) => tag.startsWith(typed) && !chosen.has(tag)).slice(0, 5);

  const complete = (tag: string) => {
    setTags(`${tags.slice(0, tags.length - typed.length)}${tag} `);
    setSuggesting(false);
  };

  const submit = () => {
    if (name.trim() === '') {
      setError('Nazwij rozdanie, żeby dało się je później odnaleźć.');
      return;
    }

    setBusy(true);
    setError(null);
    onSubmit({ name: name.trim(), tags, comment: comment.trim() })
      .then(() => onClose())
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="save-deal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="save-deal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-deal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="save-deal-title">{title}</h2>

        <label className="save-deal-field">
          <span>Nazwa</span>
          <input ref={nameRef} type="text" value={name} autoFocus disabled={busy} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="save-deal-field">
          <span>Tagi</span>
          <input
            type="text"
            value={tags}
            placeholder="np. wtrącenie szlemik"
            disabled={busy}
            onChange={(event) => { setTags(event.target.value); setSuggesting(true); }}
            onFocus={() => setSuggesting(true)}
            /* Delayed, because a click on a suggestion takes the focus out of the field before it lands. */
            onBlur={() => window.setTimeout(() => setSuggesting(false), 120)}
          />
          {!suggesting || suggestions.length === 0 ? null : (
            <div className="save-deal-suggestions">
              {suggestions.map((tag) => (
                <button key={tag} type="button" className="small" onMouseDown={(event) => event.preventDefault()} onClick={() => complete(tag)}>
                  {tag}
                </button>
              ))}
            </div>
          )}
        </label>

        <label className="save-deal-field">
          <span>Komentarz</span>
          <textarea rows={4} value={comment} disabled={busy} onChange={(event) => setComment(event.target.value)} />
        </label>

        {error === null ? null : <p className="save-deal-error">{error}</p>}

        {/* The pair that answers the question the dialog asked, set small: they are not errands of their own. */}
        <div className="save-deal-actions">
          <button type="button" className="small" disabled={busy} onClick={onClose}>
            <CloseIcon />
            <span>Odrzuć</span>
          </button>
          <button type="button" className="small primary" disabled={busy || name.trim() === ''} onClick={submit}>
            <CheckIcon />
            <span>{busy ? busyLabel : submitLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** The word still being typed: everything after the last separator, which is the only one suggesting can help with. */
function lastWord(tags: string): string {
  const separator = Math.max(tags.lastIndexOf(' '), tags.lastIndexOf(','), tags.lastIndexOf(';'));
  return tags.slice(separator + 1);
}
