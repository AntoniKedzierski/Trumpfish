import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteBiddingSystem, forkSeedSystem, listBiddingSystems, listSeedSystems, renameBiddingSystem, reforkSystem } from '@/api/biddingSystems';
import type { BiddingSystemSummary } from '@/api/models';
import { useAuth } from '@/auth/useAuth';
import './ManageSystemsPage.css';

export function ManageSystemsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.isAdmin ?? false;

  const [systems, setSystems] = useState<BiddingSystemSummary[]>([]);
  const [seeds, setSeeds] = useState<BiddingSystemSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  // An administrator's list already is the seed catalogue, so fetching it twice would only duplicate every row.
  const load = useCallback(() => Promise.all([listBiddingSystems(), isAdmin ? Promise.resolve([]) : listSeedSystems()]), [isAdmin]);

  const refresh = useCallback(async () => {
    const [own, available] = await load();
    setSystems(own);
    setSeeds(available);
  }, [load]);

  // State is written from the promise callbacks only, which keeps the effect body free of synchronous renders.
  useEffect(() => {
    let cancelled = false;
    load().then(
      ([own, available]) => { if (!cancelled) { setSystems(own); setSeeds(available); } },
      (reason) => { if (!cancelled) { setError(describe(reason)); } },
    );

    return () => { cancelled = true; };
  }, [load]);

  const run = useCallback(async (operation: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const message = await operation();
      await refresh();
      if (message !== null) {
        setNotice(message);
      }
    } catch (reason) {
      setError(describe(reason));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const submitRename = () => {
    if (renaming === null || renaming.name.trim() === '') {
      return;
    }

    const { id, name } = renaming;
    setRenaming(null);
    return run(async () => {
      await renameBiddingSystem(id, name.trim());
      return `Zmieniono nazwę na „${name.trim()}”.`;
    });
  };

  const confirmDelete = (system: BiddingSystemSummary) => {
    const warning = system.isSeed
      ? `Usunąć seed „${system.name}”? Kopie użytkowników pozostaną, ale stracą powiązanie z nim.`
      : `Usunąć system „${system.name}”? Tej operacji nie można cofnąć.`;

    if (!window.confirm(warning)) {
      return;
    }

    return run(async () => {
      await deleteBiddingSystem(system.id);
      return `Usunięto „${system.name}”.`;
    });
  };

  return (
    <div className="manage-systems">
      <header className="page-header">
        <Link to="/tools/bidding-browser" className="back-link">← Bidding Browser</Link>
        <h1>{isAdmin ? 'Systemy wzorcowe' : 'Moje systemy'}</h1>
        {busy && <span className="status">Pracuję…</span>}
        {notice && <span className="status notice">{notice}</span>}
        {error && <span className="status error">{error}</span>}
      </header>

      <p className="manage-intro">
        {isAdmin
          ? 'Twoje systemy są systemami wzorcowymi (seed). Każdy nowy system, który utworzysz lub zaimportujesz, staje się seedem dostępnym dla wszystkich użytkowników.'
          : 'Tutaj zarządzasz swoimi systemami. Systemy wzorcowe możesz skopiować do siebie i dowolnie zmieniać kopię.'}
      </p>

      <section>
        <h2>{isAdmin ? 'Seedy' : 'Twoje systemy'}</h2>
        {systems.length === 0 ? (
          <p className="empty">{isAdmin ? 'Brak seedów. Zaimportuj system w Bidding Browserze, aby go dodać.' : 'Nie masz jeszcze żadnego systemu. Skopiuj system wzorcowy poniżej albo utwórz własny.'}</p>
        ) : (
          <table className="systems">
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Odzywki</th>
                <th>Ostatnia zmiana</th>
                <th aria-label="Akcje" />
              </tr>
            </thead>
            <tbody>
              {systems.map((system) => (
                <tr key={system.id} className={system.seedUpdateAvailable ? 'has-update' : undefined}>
                  <td>
                    {renaming?.id === system.id ? (
                      <input
                        className="rename"
                        value={renaming.name}
                        autoFocus
                        onChange={(event) => setRenaming({ id: system.id, name: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') { void submitRename(); }
                          if (event.key === 'Escape') { setRenaming(null); }
                        }}
                        onBlur={() => void submitRename()}
                      />
                    ) : (
                      <>
                        <span className="name">{system.name}</span>
                        {system.forkedFromName !== null && system.forkedFromName !== undefined && (
                          <span className="origin">kopia „{system.forkedFromName}”</span>
                        )}
                        {system.seedUpdateAvailable && <span className="seed-badge">system wzorcowy się zmienił</span>}
                      </>
                    )}
                  </td>
                  <td className="numeric">{system.bidCount}</td>
                  <td className="numeric">{formatDate(system.modifiedUtc)}</td>
                  <td className="actions"><div>
                    <button type="button" onClick={() => navigate(`/tools/bidding-browser?system=${system.id}`)} disabled={busy}>Otwórz</button>
                    <button type="button" onClick={() => setRenaming({ id: system.id, name: system.name })} disabled={busy}>Zmień nazwę</button>
                    {system.seedUpdateAvailable && (
                      <button
                        type="button"
                        className="accent"
                        disabled={busy}
                        title="Nadpisuje Twoją kopię aktualną wersją systemu wzorcowego. Twoje własne zmiany w tej kopii zostaną utracone."
                        onClick={() => {
                          if (!window.confirm(`Pobrać nową wersję „${system.forkedFromName}”? Twoje zmiany w kopii „${system.name}” zostaną nadpisane.`)) {
                            return;
                          }
                          void run(async () => {
                            await reforkSystem(system.id);
                            return `Zaktualizowano „${system.name}” do bieżącej wersji wzorca.`;
                          });
                        }}
                      >
                        Pobierz zmiany
                      </button>
                    )}
                    <button type="button" className="danger" onClick={() => void confirmDelete(system)} disabled={busy}>Usuń</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {!isAdmin && (
        <section>
          <h2>Systemy wzorcowe</h2>
          {seeds.length === 0 ? (
            <p className="empty">Administrator nie udostępnił jeszcze żadnego systemu.</p>
          ) : (
            <table className="systems">
              <thead>
                <tr>
                  <th>Nazwa</th>
                  <th>Odzywki</th>
                  <th>Ostatnia zmiana</th>
                  <th aria-label="Akcje" />
                </tr>
              </thead>
              <tbody>
                {seeds.map((seed) => (
                  <tr key={seed.id}>
                    <td><span className="name">{seed.name}</span></td>
                    <td className="numeric">{seed.bidCount}</td>
                    <td className="numeric">{formatDate(seed.modifiedUtc)}</td>
                    <td className="actions"><div>
                      <button
                        type="button"
                        className="accent"
                        disabled={busy}
                        onClick={() => void run(async () => {
                          const fork = await forkSeedSystem(seed.id);
                          return `Utworzono kopię „${fork.name}”.`;
                        })}
                      >
                        Kopiuj do siebie
                      </button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
