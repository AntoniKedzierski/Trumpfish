import { useCallback, useEffect, useReducer, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBiddingSystem, listBiddingSystems, saveBiddingSystem, validateBiddingSystem } from '@/api/biddingSystems';
import type { BiddingSystem, BiddingSystemSummary } from '@/api/models';
import { BidEditorPanel } from '../components/BidEditorPanel';
import { BidTreeView } from '../components/BidTreeView';
import { Toolbar } from '../components/Toolbar';
import { ValidationPanel } from '../components/ValidationPanel';
import { inheritedRanges } from '../constraints';
import { createEmptySystem, normalizeSystem } from '../model';
import { browserReducer, initialBrowserState } from '../state';
import { findNodeById, getNode, resolveIssuePath } from '../tree';
import './BiddingBrowserPage.css';

export function BiddingBrowserPage() {
  const [state, dispatch] = useReducer(browserReducer, initialBrowserState);
  const [savedSystems, setSavedSystems] = useState<BiddingSystemSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSavedSystems = useCallback(async () => {
    try {
      setSavedSystems(await listBiddingSystems());
    } catch (reason) {
      setError(describe(reason));
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

  const run = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (reason) {
      setError(describe(reason));
    } finally {
      setBusy(false);
    }
  }, []);

  const handleSave = () => run(async () => {
    await saveBiddingSystem(state.system.systemName, state.system as BiddingSystem);
    dispatch({ kind: 'markSaved' });
    await refreshSavedSystems();
  });

  const handleLoad = (name: string) => run(async () => {
    dispatch({ kind: 'loadSystem', system: normalizeSystem(await getBiddingSystem(name)) });
  });

  const handleValidate = () => run(async () => {
    dispatch({ kind: 'setIssues', issues: await validateBiddingSystem(state.system as BiddingSystem) });
  });

  const handleImport = (file: File) => run(async () => {
    dispatch({ kind: 'loadSystem', system: normalizeSystem(JSON.parse(await file.text()) as BiddingSystem) });
  });

  const handleExport = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state.system, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.system.systemName}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectedNode = getNode(state.system, state.selection);

  return (
    <div className="bidding-browser">
      <header className="page-header">
        <Link to="/" className="back-link">← Narzędzia</Link>
        <h1>Bidding Browser</h1>
        {busy && <span className="status">Pracuję…</span>}
        {error && <span className="status error">{error}</span>}
      </header>

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
        onNew={() => dispatch({ kind: 'loadSystem', system: createEmptySystem() })}
        onImport={handleImport}
        onExport={handleExport}
      />

      <div className="workspace">
        <BidTreeView system={state.system} selection={state.selection} onSelect={(target) => dispatch({ kind: 'select', target })} />
        <BidEditorPanel node={selectedNode} inherited={inheritedRanges(state.system, state.selection)} onChange={(patch) => dispatch({ kind: 'updateNode', patch })} />
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
