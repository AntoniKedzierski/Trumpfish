import { useState } from 'react';
import { bidCode, suitClassName, type EditableBidNode, type EditableSystem, type NodePath } from '../model';
import { childPath, samePath } from '../tree';

interface BidTreeViewProps {
  system: EditableSystem;
  selection: NodePath | null;
  onSelect: (target: NodePath) => void;
}

export function BidTreeView({ system, selection, onSelect }: BidTreeViewProps) {
  return (
    <ul className="tree">
      {system.roots.map((root, rootIndex) => (
        <TreeBranch
          key={root.name ?? rootIndex}
          label={<span className="tree-root-label">{root.name}</span>}
          target={{ rootIndex, path: [] }}
          children_={root.bids}
          selection={selection}
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
  onSelect: (target: NodePath) => void;
  initiallyExpanded?: boolean;
}

function TreeBranch({ label, target, children_, selection, onSelect, initiallyExpanded = false }: TreeBranchProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const selected = samePath(selection, target);

  return (
    <li>
      <div
        className={`tree-row${selected ? ' selected' : ''}`}
        onClick={() => onSelect(target)}
        onDoubleClick={() => { if (children_.length > 0) { setExpanded(!expanded); } }}
      >
        <button type="button" className="tree-toggle" disabled={children_.length === 0} onClick={(event) => { event.stopPropagation(); setExpanded(!expanded); }}>
          {children_.length === 0 ? '·' : expanded ? '▾' : '▸'}
        </button>
        {label}
      </div>

      {expanded && children_.length > 0 && (
        <ul>
          {children_.map((node, index) => (
            <TreeBranch key={index} label={<BidLabel node={node} />} target={childPath(target, index)} children_={node.nextBids} selection={selection} onSelect={onSelect} />
          ))}
        </ul>
      )}
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
    </span>
  );
}
