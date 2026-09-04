import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router-dom';
import { createBiddingSystem, getBiddingSystem, listBiddingSystems, reforkSystem, saveBiddingSystem, validateBiddingSystem } from '@/api/biddingSystems';
import { toNumber, type BiddingSystem, type BiddingSystemSummary, type NumberRange, type ValidationIssue } from '@/api/models';
import { useAuth } from '@/auth/useAuth';
import { BidEditorPanel } from '../components/BidEditorPanel';
import { BidTreeView } from '../components/BidTreeView';
import { PaneSplitter } from '../components/PaneSplitter';
import { Toolbar } from '../components/Toolbar';
import { UnsavedChangesPrompt } from '../components/UnsavedChangesPrompt';
import { ValidationPanel } from '../components/ValidationPanel';
import { inheritedRanges, type RangeField } from '../constraints';
import { createEmptySystem, normalizeSystem, type EditableBidNode, type NodePath } from '../model';
import { browserReducer, initialBrowserState, type BrowserAction } from '../state';
import { findNodeById, getNode, resolveIssuePath, ancestorNodes } from '../tree';
import { removeUnreachable, type CleanupResult } from '../unreachable';
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
  // Both are bumped to fire a one-off effect: focus the meaning field, and bring the selected bid into view in the tree.
  const [conditionFocus, setConditionFocus] = useState(0);
  const [revealKey, setRevealKey] = useState(0);

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

  /**
   * Where the bid behind each issue currently sits. The list is whatever the last run found, so editing the tree underneath it
   * leaves entries pointing at bids that are gone; those simply do not make it into the map and the panel greys them out.
   */
  const issueTargets = useMemo(() => {
    const targets = new Map<ValidationIssue, NodePath>();
    for (const issue of state.issues ?? []) {
      const target = findNodeById(state.system, issue.nodeId) ?? resolveIssuePath(state.system, issue.path);
      if (target !== null) {
        targets.set(issue, target);
      }
    }

    return targets;
  }, [state.issues, state.system]);

  // Holds back any navigation out of the browser - a link, a programmatic redirect or the back button - while edits are unsaved.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => state.dirty && currentLocation.pathname !== nextLocation.pathname);

  // Closing or reloading the tab never reaches the router, so the browser's own prompt has to cover that way out.
  useEffect(() => {
    if (!state.dirty) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Still required by browsers that predate `preventDefault` being enough; the text itself is never shown.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.dirty]);

  // The write itself, shared by the plain save and by save-and-validate so the two can never drift apart.
  // A system with no id has never been stored, so saving it creates one. For an administrator that new system is a seed.
  const persist = async () => {
    const summary = state.systemId === null
      ? await createBiddingSystem(state.system.systemName, state.system as BiddingSystem)
      : await saveBiddingSystem(state.systemId, state.system as BiddingSystem);

    dispatch({ kind: 'markSaved', systemId: summary.id });
    await refreshSavedSystems();
    return summary;
  };

  const handleSave = () => run(async () => {
    const created = state.systemId === null;
    const summary = await persist();
    setNotice(created && isAdmin ? `Zapisano „${summary.name}” jako system wzorcowy.` : `Zapisano „${summary.name}”.`);
  });

  // One gesture, one operation: a save that fails must not be followed by validating the tree anyway.
  const handleSaveAndValidate = () => run(async () => {
    const summary = await persist();
    dispatch({ kind: 'setIssues', issues: await validateBiddingSystem(state.system as BiddingSystem) });
    setNotice(`Zapisano „${summary.name}” i sprawdzono system.`);
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

  /**
   * Applies a repair the validator worked out, to the bid the issue belongs to. The bid is selected on the way, so the change
   * happens in front of the author rather than somewhere off screen.
   */
  const repairIssue = (issue: ValidationIssue, patchFor: (node: EditableBidNode) => Partial<EditableBidNode> | null) => {
    const target = issueTargets.get(issue) ?? null;
    const node = target === null ? null : getNode(state.system, target);
    const patch = node === null ? null : patchFor(node);
    if (target === null || patch === null) {
      return;
    }

    dispatch({ kind: 'select', target });
    dispatch({ kind: 'updateNode', patch });

    // The rest of the list is still whatever the last run found; only the issue just settled is known to be gone.
    dispatch({ kind: 'setIssues', issues: (state.issues ?? []).filter((candidate) => candidate !== issue) });
  };

  /** The description was right and the ranges lagged behind: write the stated bound into the bid. */
  const handleRepairRanges = (issue: ValidationIssue) => repairIssue(issue, (node) => {
    const repair = issue.repair;
    if (!repair) {
      return null;
    }

    const field = repair.field as RangeField;
    const current = (node[field] ?? {}) as NumberRange;
    return { [field]: { ...current, [repair.bound]: toNumber(repair.value) } } as Partial<EditableBidNode>;
  });

  /** The ranges were right and the description overstated them: replace the text with what the auction implies. */
  const handleRepairCondition = (issue: ValidationIssue) => repairIssue(issue, () => (
    issue.conditionRepair ? { condition: issue.conditionRepair } : null
  ));

  // Clears the branch of bids the auction can never arrive at. Destructive and potentially large, so the tally is shown first.
  const handleRemoveUnreachable = () => {
    const result = removeUnreachable(state.system, state.selection);
    const summary = summariseCleanup(result);
    if (summary === null) {
      setNotice('Nie znaleziono nic do wyczyszczenia.');
      return;
    }

    if (!window.confirm(`Wyczyścić: ${summary}? Tej operacji nie można cofnąć.`)) {
      return;
    }

    dispatch({ kind: 'replaceSystem', system: result.system });
    setNotice(`Wyczyszczono: ${summary}.`);
  };

  // Adding a bid hands the caret straight to "Znaczenie", the field that actually gets filled in next. Pasting is left out:
  // a pasted subtree already carries its descriptions.
  const addAndDescribe = (action: BrowserAction) => {
    dispatch(action);
    setConditionFocus((key) => key + 1);
  };

  // The listener is registered once, so it reaches the current handlers through a ref instead of closing over stale ones.
  const commandsRef = useRef({ save: handleSave, saveAndValidate: handleSaveAndValidate, addAndDescribe });
  useEffect(() => { commandsRef.current = { save: handleSave, saveAndValidate: handleSaveAndValidate, addAndDescribe }; });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // Alt rather than Ctrl+Shift, which Chrome keeps for its own developer tools. Ctrl must be absent: on a Polish keyboard
      // AltGr reports itself as Ctrl+Alt, so requiring plain Alt is what keeps AltGr+C ("ć") out of this.
      if (event.altKey && !event.ctrlKey) {
        if (key === 'c') {
          event.preventDefault();
          dispatch({ kind: 'copyChildren' });
        }

        return;
      }

      if (!event.ctrlKey) {
        return;
      }

      // Ctrl+Shift commands stay live while a field has the caret: describing one bid and then adding the next is a single
      // flow, and none of these chords mean anything to a text field.
      if (event.shiftKey) {
        const commands = commandsRef.current;
        switch (key) {
          case 'a':
            event.preventDefault();
            return commands.addAndDescribe({ kind: 'addSibling' });
          case 'd':
            event.preventDefault();
            return commands.addAndDescribe({ kind: 'duplicate' });
          case 's':
            event.preventDefault();
            return commands.save();
          case 'v':
            event.preventDefault();
            return commands.saveAndValidate();
          case 'f':
            event.preventDefault();
            return setRevealKey((current) => current + 1);
          case 'x':
            event.preventDefault();
            return dispatch({ kind: 'cutChildren' });
          default:
            return;
        }
      }

      // The plain clipboard chords mirror the WPF commands but stay inside the app, so a copied subtree keeps its structure.
      // Inside a field the browser's own cut, copy and paste have to win.
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) {
        return;
      }

      if (key === 'c') {
        dispatch({ kind: 'copy' });
      } else if (key === 'v') {
        dispatch({ kind: 'paste' });
      } else if (key === 'x') {
        event.preventDefault();
        dispatch({ kind: 'cut' });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectedNode = getNode(state.system, state.selection);

  return (
    <div className="bidding-browser">
      <UnsavedChangesPrompt blocker={blocker} />

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
        onAdd={() => addAndDescribe({ kind: 'addBid' })}
        onDelete={() => dispatch({ kind: 'deleteBid' })}
        onMoveUp={() => dispatch({ kind: 'moveUp' })}
        onMoveDown={() => dispatch({ kind: 'moveDown' })}
        onSort={() => dispatch({ kind: 'sort' })}
        onRemoveUnreachable={handleRemoveUnreachable}
        onValidate={handleValidate}
        onSave={handleSave}
        onLoad={handleLoad}
        onNew={() => dispatch({ kind: 'loadSystem', system: createEmptySystem(), systemId: null })}
        onImport={handleImport}
        onExport={handleExport}
      />

      {/* The editor column is what the splitter sizes; the tree takes whatever is left. */}
      <div className="workspace" style={{ gridTemplateColumns: `minmax(0, 1fr) auto ${editorWidth}px` }}>
        <BidTreeView system={state.system} selection={state.selection} revealKey={revealKey} onSelect={(target) => dispatch({ kind: 'select', target })} />
        <PaneSplitter width={editorWidth} onWidthChange={setEditorWidth} />
        <BidEditorPanel
          node={selectedNode}
          rootName={state.system.roots[state.selection?.rootIndex ?? -1]?.name ?? null}
          focusConditionKey={conditionFocus}
          inherited={inheritedRanges(state.system, state.selection)}
          ancestors={ancestorNodes(state.system, state.selection)}
          onChange={(patch) => dispatch({ kind: 'updateNode', patch })}
        />
      </div>

      <ValidationPanel
        issues={state.issues}
        onRepairRanges={handleRepairRanges}
        onRepairCondition={handleRepairCondition}
        isStale={(issue) => !issueTargets.has(issue)}
        onSelectIssue={(issue) => {
          const target = issueTargets.get(issue);
          if (target !== undefined) {
            dispatch({ kind: 'select', target });
            setRevealKey((key) => key + 1);
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

/** What the cleanup would do, or null when there is nothing to do. */
function summariseCleanup(result: CleanupResult): string | null {
  const parts: string[] = [];

  if (result.removed > 0) {
    parts.push(inflect(result.removed, 'nieosiągalną odzywkę', 'nieosiągalne odzywki', 'nieosiągalnych odzywek'));
  }

  if (result.relaxed > 0) {
    parts.push(inflect(result.relaxed, 'zbędny górny limit', 'zbędne górne limity', 'zbędnych górnych limitów'));
  }

  return parts.length === 0 ? null : parts.join(' oraz ');
}

/** Polish inflects both the adjective and the noun, and in three ways, so the whole phrase is picked rather than a suffix. */
function inflect(count: number, one: string, few: string, many: string): string {
  if (count === 1) {
    return `1 ${one}`;
  }

  const tens = count % 100;
  const units = count % 10;
  return `${count} ${units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many}`;
}
