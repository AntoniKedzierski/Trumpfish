import { bidCode, suitClassName, type EditableBidNode } from '../model';
import { formatInterjection } from '../interjection';

interface BidPathProps {
  /** Name of the root the edited bid lives under, shown as the outermost level. */
  rootName: string | null;
  /** Bids said before the edited one, from the root down to its parent. */
  ancestors: readonly EditableBidNode[];
}

/**
 * The branch the edited bid sits in, the way a code editor keeps the enclosing scopes in view. Each level is its own row,
 * deliberately inert: it is a reminder of where you are, not another way to navigate.
 */
export function BidPath({ rootName, ancestors }: BidPathProps) {
  // A single row would only name the root, which the tree already shows; the path earns its space once there is a branch to trace.
  if (ancestors.length === 0) {
    return null;
  }

  // A disabled ancestor switches off everything below it, so the greying carries on down the rest of the path.
  const disabledFrom = ancestors.findIndex((node) => node.isDisabled);

  return (
    <div className="tree-path" aria-hidden="true">
      <div className="tree-path-row" style={{ paddingLeft: indentFor(0) }}>
        <span className="tree-root-label">{rootName}</span>
      </div>

      {ancestors.map((node, depth) => (
        <div
          key={node.nodeId ?? depth}
          className={`tree-path-row${disabledFrom >= 0 && depth >= disabledFrom ? ' disabled' : ''}`}
          style={{ paddingLeft: indentFor(depth + 1) }}
        >
          <span className="bid-code">
            {node.value ?? ''}
            <span className={suitClassName(node)}>{bidCode(node)}</span>
          </span>
          {/* Kept in the same place as in the tree: an interjection changes what the bid under it means, so the path has to show it. */}
          {node.interjection && (
            <span className="bid-interjection">
              (po. <span className={suitClassName(node.interjection)}>{formatInterjection(node.interjection)}</span>)
            </span>
          )}
          {node.condition && <span className="bid-condition">{node.condition}</span>}
        </div>
      ))}
    </div>
  );
}

/** Mirrors the tree's own 22px guide-rail step, so a path row lines up with the branch it stands for. */
function indentFor(depth: number): string {
  return `${12 + depth * 12}px`;
}
