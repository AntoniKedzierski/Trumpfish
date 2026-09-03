import { useEffect, useRef, useState } from 'react';
import { Chevron } from '@/components/Select';
import { bidCode, suitClassName, type EditableBidNode, type EditableSystem, type NodePath } from '../model';
import { formatInterjection } from '../interjection';
import { childPath, containsPath, folderPathUnder, holdsInterjected, interjectedCount, samePath } from '../tree';

interface BidTreeViewProps {
  system: EditableSystem;
  selection: NodePath | null;
  /** Bumped to scroll the selected bid back into view on demand, even though the selection itself has not moved. */
  revealKey: number;
  onSelect: (target: NodePath) => void;
}

export function BidTreeView({ system, selection, revealKey, onSelect }: BidTreeViewProps) {
  return (
    <ul className="tree">
      {system.roots.map((root, rootIndex) => (
        <TreeBranch
          key={root.name ?? rootIndex}
          label={<span className="tree-root-label">{root.name}</span>}
          target={{ rootIndex, path: [] }}
          children_={root.bids}
          selection={selection}
          revealKey={revealKey}
          onSelect={onSelect}
          initiallyExpanded
        />
      ))}
    </ul>
  );
}

interface TreeBranchProps {
  label: React.ReactNode;
  target: NodePath;
  children_: EditableBidNode[];
  selection: NodePath | null;
  revealKey: number;
  onSelect: (target: NodePath) => void;
  /** Marks the branch as switched off. Only the head of the branch is told; the styling reaches the rest through the cascade. */
  disabled?: boolean;
  initiallyExpanded?: boolean;
}

function TreeBranch({ label, target, children_, selection, revealKey, onSelect, disabled = false, initiallyExpanded = false }: TreeBranchProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  // Children mount on the first expand and then stay mounted, so the collapse can animate instead of snapping shut.
  const [mounted, setMounted] = useState(initiallyExpanded);
  const rowRef = useRef<HTMLDivElement>(null);
  const selected = samePath(selection, target);
  const leaf = children_.length === 0;
  const holdsSelection = containsPath(target, selection);
  // A branch on the way to the selection is open by definition, so picking a node from outside the tree reveals it without extra state.
  const open = expanded || holdsSelection;

  // `revealKey` is in the deps so the "go to the selected bid" command re-runs this even when the selection itself is unchanged.
  useEffect(() => {
    if (selected) {
      rowRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [selected, revealKey]);

  const toggle = () => {
    if (leaf) {
      return;
    }

    // Collapsing a branch that holds the selection would be ignored, so move the selection onto the branch itself.
    if (open && holdsSelection) {
      onSelect(target);
    }

    setMounted(true);
    setExpanded(!open);
  };

  return (
    <li className={disabled ? 'disabled' : undefined}>
      {/* A double click both selects the row and expands it: the click that opens the branch is also the one that picks it. */}
      <div ref={rowRef} className={`tree-row${selected ? ' selected' : ''}`} onClick={() => onSelect(target)} onDoubleClick={toggle}>
        {/* The chevron toggles on its own, so the row must not treat a double click on it as a second toggle. */}
        <button type="button" className={`tree-toggle${open ? ' expanded' : ''}${leaf ? ' leaf' : ''}`} disabled={leaf} onClick={(event) => { event.stopPropagation(); toggle(); }} onDoubleClick={(event) => event.stopPropagation()} aria-label={open ? 'Zwiń' : 'Rozwiń'}>
          {leaf ? <span className="tree-leaf-dot" aria-hidden="true" /> : <Chevron />}
        </button>
        {label}
      </div>

      {(mounted || holdsSelection) && !leaf && (
        <div className={`tree-children${open ? ' expanded' : ''}`}>
          <ul>
            <TreeChildren container={target} children_={children_} selection={selection} revealKey={revealKey} onSelect={onSelect} />
          </ul>
        </div>
      )}
    </li>
  );
}

interface TreeChildrenProps {
  container: NodePath;
  children_: EditableBidNode[];
  selection: NodePath | null;
  revealKey: number;
  onSelect: (target: NodePath) => void;
}

/**
 * Lays out one list of bids: the interjected ones gathered into a folder at the top, everything else below it.
 *
 * The folder is drawn, not stored. Interjected bids are kept at the front of the list, so it is simply the leading run of that
 * list given a heading - which is why the positions the rest of the browser addresses stay exactly what they were.
 */
function TreeChildren({ container, children_, selection, revealKey, onSelect }: TreeChildrenProps) {
  const count = interjectedCount(children_);

  return (
    <>
      {count > 0 && (
        <InterjectionFolder container={container} held={children_.slice(0, count)} selection={selection} revealKey={revealKey} onSelect={onSelect} />
      )}

      {children_.slice(count).map((node, offset) => (
        <TreeBranch
          key={node.nodeId ?? count + offset}
          label={<BidLabel node={node} />}
          target={childPath(container, count + offset)}
          children_={node.nextBids}
          selection={selection}
          revealKey={revealKey}
          onSelect={onSelect}
          disabled={node.isDisabled}
        />
      ))}
    </>
  );
}

interface InterjectionFolderProps {
  container: NodePath;
  held: EditableBidNode[];
  selection: NodePath | null;
  revealKey: number;
  onSelect: (target: NodePath) => void;
}

/** Heading over the bids said after an opponent call. Selectable, so a bid can be added into it, but it is not a bid itself. */
function InterjectionFolder({ container, held, selection, revealKey, onSelect }: InterjectionFolderProps) {
  const target = folderPathUnder(container);
  const [expanded, setExpanded] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const selected = samePath(selection, target);
  const holdsSelection = holdsInterjected(container, selection, held.length);
  const open = expanded || holdsSelection;

  useEffect(() => {
    if (selected) {
      rowRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [selected, revealKey]);

  return (
    <li>
      <div ref={rowRef} className={`tree-row interjection-folder${selected ? ' selected' : ''}`} onClick={() => onSelect(target)} onDoubleClick={() => setExpanded(!open)}>
        <button type="button" className={`tree-toggle${open ? ' expanded' : ''}`} onClick={(event) => { event.stopPropagation(); setExpanded(!open); }} onDoubleClick={(event) => event.stopPropagation()} aria-label={open ? 'Zwiń' : 'Rozwiń'}>
          <Chevron />
        </button>
        <span className="tree-folder-label">Wtrącenia</span>
        <span className="tree-folder-count">{held.length}</span>
      </div>

      <div className={`tree-children${open ? ' expanded' : ''}`}>
        <ul>
          {held.map((node, index) => (
            <TreeBranch
              key={node.nodeId ?? index}
              label={<BidLabel node={node} />}
              target={childPath(container, index)}
              children_={node.nextBids}
              selection={selection}
              revealKey={revealKey}
              onSelect={onSelect}
              disabled={node.isDisabled}
            />
          ))}
        </ul>
      </div>
    </li>
  );
}

function BidLabel({ node }: { node: EditableBidNode }) {
  return (
    <span className="bid-label">
      <span className="bid-code">
        {node.value ?? ''}
        <span className={suitClassName(node)}>{bidCode(node)}</span>
      </span>
      <span className="bid-separator">:</span>
      {node.interjection && (
        <span className="bid-interjection">
          (po. <span className={suitClassName(node.interjection)}>{formatInterjection(node.interjection)}</span>)
        </span>
      )}
      <span className="bid-condition">{node.condition}</span>
      {node.convention && <span className="bid-convention">⟨ {node.convention} ⟩</span>}
      <BidBadges node={node} />
    </span>
  );
}

function BidBadges({ node }: { node: EditableBidNode }) {
  return (
    <span className="bid-badges">
      <img src={node.openerBid ? '/images/opener.png' : '/images/resondent.png'} className={node.openerBid ? 'badge' : 'badge mirrored'} alt="" title={node.openerBid ? 'Otwierający' : 'Odpowiadający'} />
      {node.automaticResponse && <img src="/images/auto.png" className="badge small" alt="" title="Odzywka automatyczna" />}
      {node.gameForcing && <img src="/images/gameForcing.png" className="badge small" alt="" title="Forsująca do końcówki" />}
      {node.oneRoundForcing && <img src="/images/oneRoundForcing.png" className="badge small" alt="" title="Forsująca na jedno kółko" />}
      {node.signOff && <img src="/images/signoff.png" className="badge small" alt="" title="Odzywka wyprzęgająca" />}
      {node.isPreferred && <span className="badge-preferred" title="Odzywka preferowana">!</span>}
    </span>
  );
}
