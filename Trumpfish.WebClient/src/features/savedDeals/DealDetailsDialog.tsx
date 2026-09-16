import { useEffect, useRef, useState } from 'react';
import { listMyDealTags } from '@/api/savedDeals';
import { CheckIcon, CloseIcon } from '@/components/icons';
import { Button, Dialog, Field, TextBox } from '@/ui';
import './savedDeals.css';

export interface DealDetails {
  name: string;
  tags: string;
  comment: string;
}

interface DealDetailsDialogProps {
  title: string;
  initial: DealDetails;
  /** Co mówi przycisk potwierdzenia, kiedy czeka, i co mówi przez resztę czasu. */
  submitLabel: string;
  busyLabel: string;
  /** Odrzuca wiadomością do pokazania; spełnienie znaczy „gotowe" i okno zamyka się samo. */
  onSubmit: (details: DealDetails) => Promise<unknown>;
  onClose: () => void;
}

/**
 * To, co w zapisanym rozdaniu wie tylko użytkownik: jak je nazwać, pod czym je odłożyć i co warto o nim powiedzieć.
 */
/*
 * Jedno okno na zapisanie rozdania i na edycję już zapisanego. Zadają dokładnie te same trzy pytania, a dwie kopie
 * byłyby dwoma miejscami, w których pole tagów może zacząć zachowywać się inaczej.
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

  // Własne słowa kluczowe użytkownika, pobierane raz przy otwarciu. Nigdy nie ma ich wiele, więc filtruje się tutaj.
  useEffect(() => {
    let cancelled = false;
    listMyDealTags().then(
      (loaded) => { if (!cancelled) { setKnown(loaded.map((tag) => tag.tag)); } },
      () => undefined,
    );

    nameRef.current?.select();
    return () => { cancelled = true; };
  }, []);

  /*
   * Podpowiadane do pisanego słowa, a nie do całego pola: tagi są listą, a ten, w środku którego użytkownik właśnie
   * jest, to jedyny, w którym da się jeszcze pomóc. Pięć, od najczęściej używanego - lista przychodzi w tej kolejności.
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
    <Dialog
      title={title}
      onClose={onClose}
      /* Para, która odpowiada na pytanie zadane przez okno, złożona mało: to nie są sprawy same w sobie. */
      actions={
        <>
          <Button size="small" icon={CloseIcon} disabled={busy} onClick={onClose}>Odrzuć</Button>
          <Button size="small" icon={CheckIcon} variant="primary" disabled={busy || name.trim() === ''} onClick={submit}>
            {busy ? busyLabel : submitLabel}
          </Button>
        </>
      }
    >
      <Field label="Nazwa">
        <TextBox ref={nameRef} value={name} autoFocus disabled={busy} onChange={setName} />
      </Field>

      <Field label="Tagi">
        <TextBox
          value={tags}
          placeholder="wtrącenie"
          disabled={busy}
          onChange={(next) => { setTags(next); setSuggesting(true); }}
          onFocus={() => setSuggesting(true)}
          /* Z opóźnieniem, bo kliknięcie w podpowiedź zabiera pole z fokusu, zanim wyląduje. */
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
      </Field>

      <Field label="Komentarz">
        <textarea rows={4} value={comment} disabled={busy} onChange={(event) => setComment(event.target.value)} />
      </Field>

      {error === null ? null : <p className="ui-dialog-error">{error}</p>}
    </Dialog>
  );
}

/** Słowo, w którym stoi kursor - czyli ostatnie, bo pisze się na końcu pola. */
function lastWord(tags: string): string {
  const parts = tags.split(/[\s,;]/);
  return parts[parts.length - 1] ?? '';
}
