import { useCallback, useEffect, useReducer, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createBiddingSystem, exportSeeds, getBiddingSystem, listBiddingSystems, reforkSystem, saveBiddingSystem, validateBiddingSystem } from '@/api/biddingSystems';
import type { BiddingSystem, BiddingSystemSummary } from '@/api/models';
import { useAuth } from '@/auth/useAuth';
import { BidEditorPanel } from '../components/BidEditorPanel';
import { BidTreeView } from '../components/BidTreeView';
import { PaneSplitter } from '../components/PaneSplitter';
import { Toolbar } from '../components/Toolbar';
import { ValidationPanel } from '../components/ValidationPanel';
import { inheritedRanges } from '../constraints';
import { createEmptySystem, normalizeSystem } from '../model';
import { browserReducer, initialBrowserState } from '../state';
import { findNodeById, getNode, resolveIssuePath, ancestorNodes } from '../tree';
import './BiddingBrowserPage.css';

export function BiddingBrowserPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, dispatch] = useReducer(browserReducer, initialBrowserState);
  const [savedSystems, setSavedSystems] = useState<BiddingSystemSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editorWidth, setEditorWidth] = useState(360);

  const isAdmin = user?.isAdmin ?? false;
  const current = savedSystems.find((system) => system.id === state.systemId) ?? null;

  const refreshSavedSystems = useCallback(async () => {
    const systems = await listBiddingSystems();
    setSavedSystems(systems);
    return systems;
  }, []);

  const run = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await operation();
    } catch (reason) {
      setError(describe(reason));
    } finally {
      setBusy(false);
    }
  }, []);

  // Initial fetch keeps its own promise callbacks so no state is written synchronously while the effect runs.
  useEffect(() => {
    let cancelled = false;
    listBiddingSystems().then(
      (systems) => { if (!cancelled) { setSavedSystems(systems); } },
      (reason) => { if (!cancelled) { setError(describe(reason)); } },
    );

    return () => { cancelled = true; };
  }, []);

  // The manage page links here with the system to open. The parameter is dropped once it has been honoured, which re-runs this
  // effect with nothing left to do - all state is written from the promise callbacks so the effect body itself stays inert.
  const requestedId = searchParams.get('system');
  useEffect(() => {
    if (requestedId === null) {
      return;
    }

    let cancelled = false;
    getBiddingSystem(requestedId).then(
      (system) => {
        if (cancelled) {
          return;
        }

        dispatch({ kind: 'loadSystem', system: normalizeSystem(system), systemId: requestedId });
        setSearchParams({}, { replace: true });
      },
      (reason) => {
        if (cancelled) {
          return;
        }

        setError(describe(reason));
        setSearchParams({}, { replace: true });
      },
    );

    return () => { cancelled = true; };
  }, [requestedId, setSearchParams]);

  // Ctrl+C / Ctrl+V mirror the WPF clipboard commands, but stay inside the app so the copied subtree keeps its structure.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) {
        return;
      }

      if (event.key === 'c') {
        dispatch({ kind: 'copy' });
      } else if (event.key === 'v') {
        dispatch({ kind: 'paste' });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // A system with no id has never been stored, so saving it creates one. For an administrator that new system is a seed.
  const handleSave = () => run(async () => {
    const summary = state.systemId === null
      ? await createBiddingSystem(state.system.systemName, state.system as BiddingSystem)
      : await saveBiddingSystem(state.systemId, state.system as BiddingSystem);

    dispatch({ kind: 'markSaved', systemId: summary.id });
    await refreshSavedSystems();
    setNotice(state.systemId === null && isAdmin ? `Zapisano „${summary.name}” jako system wzorcowy.` : `Zapisano „${summary.name}”.`);
  });

  const handleLoad = (id: string) => run(async () => {
    dispatch({ kind: 'loadSystem', system: normalizeSystem(await getBiddingSystem(id)), systemId: id });
  });

  const handleValidate = () => run(async () => {
    dispatch({ kind: 'setIssues', issues: await validateBiddingSystem(state.system as BiddingSystem) });
  });

  // An imported tree is a brand new system until it is saved, so it deliberately arrives without an id.
  const handleImport = (file: File) => run(async () => {
    dispatch({ kind: 'loadSystem', system: normalizeSystem(JSON.parse(await file.text()) as BiddingSystem), systemId: null });
    setNotice(isAdmin ? 'Zaimportowano. Zapisz, aby dodać go jako system wzorcowy.' : 'Zaimportowano. Zapisz, aby dodać go do swoich systemów.');
  });

  const handleExport = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state.system, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.system.systemName}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRefork = () => {
    if (current === null || !window.confirm(`Pobrać nową wersję „${current.forkedFromName}”? Twoje zmiany w tej kopii zostaną nadpisane.`)) {
      return;
    }

    return run(async () => {
      await reforkSystem(current.id);
      dispatch({ kind: 'loadSystem', system: normalizeSystem(await getBiddingSystem(current.id)), systemId: current.id });
      await refreshSavedSystems();
      setNotice('Kopia została zaktualizowana do bieżącej wersji wzorca.');
    });
  };

  // Writes straight into the server's Seed folder instead of downloading, which is the whole point: the files land where git
  // can see them, so the team pulls them and production applies them on its next start.
  const handleExportSeeds = () => run(async () => {
    const result = await exportSeeds();
    const removed = result.removed.length === 0 ? '' : `, usunięto nieaktualne: ${result.removed.length}`;
    setNotice(`Zapisano seedy do repozytorium: ${result.written.length} plik(ów)${removed}.`);
  });

  const selectedNode = getNode(state.system, state.selection);

  return (
    <div className="bidding-browser">
      <header className="page-header">
        <Link to="/" className="back-link">← Narzędzia</Link>
        <h1>Bidding Browser</h1>
        <Link to="/tools/bidding-browser/systems" className="manage-link">Zarządzaj systemami</Link>
        {busy && <span className="status">Pracuję…</span>}
        {notice && <span className="status notice">{notice}</span>}
        {error && <span className="status error">{error}</span>}
      </header>

      {/* Only a fork can fall behind, and only its owner is offered the update - an administrator edits the seed itself. */}
      {current?.seedUpdateAvailable && (
        <div className="seed-update">
          <span>System wzorcowy „{current.forkedFromName}” został zmieniony po utworzeniu tej kopii.</span>
          <button type="button" onClick={handleRefork} disabled={busy}>Pobierz zmiany</button>
        </div>
      )}

      <Toolbar
        systemName={state.system.systemName}
        savedSystems={savedSystems}
        busy={busy}
        dirty={state.dirty}
        canEditNode={selectedNode !== null}
        onSystemNameChange={(name) => dispatch({ kind: 'setSystemName', name })}
        onAdd={() => dispatch({ kind: 'addBid' })}
        onDelete={() => dispatch({ kind: 'deleteBid' })}
        onMoveUp={() => dispatch({ kind: 'moveUp' })}
        onMoveDown={() => dispatch({ kind: 'moveDown' })}
        onSort={() => dispatch({ kind: 'sort' })}
        onValidate={handleValidate}
        onSave={handleSave}
        onLoad={handleLoad}
        onNew={() => dispatch({ kind: 'loadSystem', system: createEmptySystem(), systemId: null })}
        onImport={handleImport}
        onExport={handleExport}
        canExportSeeds={(user?.isAdmin ?? false) && (user?.isDebugBuild ?? false)}
        onExportSeeds={handleExportSeeds}
      />

      {/* The editor column is what the splitter sizes; the tree takes whatever is left. */}
      <div className="workspace" style={{ gridTemplateColumns: `minmax(0, 1fr) auto ${editorWidth}px` }}>
        <BidTreeView system={state.system} selection={state.selection} onSelect={(target) => dispatch({ kind: 'select', target })} />
        <PaneSplitter width={editorWidth} onWidthChange={setEditorWidth} />
        <BidEditorPanel
          node={selectedNode}
          rootName={state.system.roots[state.selection?.rootIndex ?? -1]?.name ?? null}
          inherited={inheritedRanges(state.system, state.selection)}
          ancestors={ancestorNodes(state.system, state.selection)}
          onChange={(patch) => dispatch({ kind: 'updateNode', patch })}
        />
      </div>

      <ValidationPanel
        issues={state.issues}
        onSelectIssue={(issue) => {
          const target = findNodeById(state.system, issue.nodeId) ?? resolveIssuePath(state.system, issue.path);
          if (target !== null) {
            dispatch({ kind: 'select', target });
          }
        }}
        onClose={() => dispatch({ kind: 'setIssues', issues: null })}
      />
    </div>
  );
}

function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
