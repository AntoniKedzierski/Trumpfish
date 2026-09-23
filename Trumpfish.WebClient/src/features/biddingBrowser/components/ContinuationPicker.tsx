import { useState } from 'react';
import { ArrowRightIcon, CheckIcon, CloseIcon, TrashIcon } from '@/components/icons';
import { BidCard, Button, Dialog } from '@/ui';
import '@/ui/comboBox.css';
import { canContinueTo, type EditableBidNode, type EditableSystem, type NodePath } from '../model';
import { ancestorNodes, findNodeById, getNode } from '../tree';
import { BidTreeView } from './BidTreeView';

interface ContinuationPickerProps {
  system: EditableSystem;
  /** Edytowana odzywka. To jej wartość i przypisanie do gracza decydują, dokąd wolno przejść. */
  node: EditableBidNode;
  /**
   * Czy w ogóle da się tu wybierać. Na wąskim ekranie nie ma gdzie postawić drzewa, więc przejście można tam tylko
   * zobaczyć, pójść za nim i usunąć je - wybiera się je przy szerokości, na której widać cały system.
   */
  pickable: boolean;
  onChange: (continuationNodeId: string | null) => void;
  /** Zaznacza wskazaną odzywkę w drzewie edytora i przewija do niej. */
  onGoTo: (target: NodePath) => void;
}

/**
 * Przejście: odzywka, do której przenosi się dalsza licytacja.
 */
/*
 * Szerokie pole mówi, dokąd prowadzi przejście - ścieżką od korzenia i znaczeniem celu, bo sama odzywka („1♠") nie
 * odróżnia dwóch takich samych w dwóch gałęziach. Obok stoją dwie komendy na tym jednym wskazaniu: pójść za nim i je
 * usunąć. Wybieranie dzieje się w oknie z całym drzewem, bo wybiera się miejsce w drzewie, a nie wartość z listy.
 */
export function ContinuationPicker({ system, node, pickable, onChange, onGoTo }: ContinuationPickerProps) {
  const [open, setOpen] = useState(false);

  const target = findNodeById(system, node.continuationNodeId);
  const found = target === null ? null : getNode(system, target);

  return (
    <div className="continuation">
      <button
        type="button"
        className="ui-combo-field continuation-field"
        aria-haspopup="dialog"
        disabled={!pickable}
        title={pickable ? 'Wybierz odzywkę, do której przechodzi licytacja' : 'Brak możliwości edycji przejści na urządzeniu moblinym'}
        onClick={() => setOpen(true)}
      >
        <span className={`ui-combo-value${found === null ? ' placeholder' : ''}`}>
          {found !== null ? <ContinuationLabel system={system} target={target!} node={found} /> : (
            node.continuationNodeId === null || node.continuationNodeId === undefined
              ? 'brak przejścia'
              : 'przejście do odzywki, której już nie ma'
          )}
        </span>
      </button>

      <Button
        iconOnly
        icon={ArrowRightIcon}
        className="continuation-command"
        title="Przejdź do wskazanej odzywki"
        aria-label="Przejdź do wskazanej odzywki"
        disabled={target === null}
        onClick={() => target !== null && onGoTo(target)}
      />

      <Button
        iconOnly
        icon={TrashIcon}
        variant="danger"
        className="continuation-command"
        title="Usuń przejście"
        aria-label="Usuń przejście"
        disabled={node.continuationNodeId === null || node.continuationNodeId === undefined}
        onClick={() => onChange(null)}
      />

      {!open ? null : (
        <ContinuationDialog
          system={system}
          node={node}
          chosen={target}
          onPick={(nodeId) => { onChange(nodeId); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Całe drzewo systemu jako miejsce wyboru.
 */
/*
 * Drzewo, a nie lista kandydatów: przejście prowadzi w konkretne miejsce systemu i to miejsce - gałąź, w której odzywka
 * stoi - jest połową odpowiedzi. Odzywki, których wybrać nie można, zostają widoczne i tylko przygasają; usunięte z
 * drzewa zabrałyby kontekst tym, które zostały.
 *
 * Zaznaczenie i zatwierdzenie są dwoma ruchami, bo kliknięcie w drzewie służy tu też do rozglądania się. Komendy stoją
 * nad drzewem: pod nim, przy oknie na całą wysokość ekranu, byłyby na końcu przewijania.
 */
function ContinuationDialog({ system, node, chosen, onPick, onClose }: {
  system: EditableSystem;
  node: EditableBidNode;
  chosen: NodePath | null;
  onPick: (continuationNodeId: string) => void;
  onClose: () => void;
}) {
  const [selection, setSelection] = useState<NodePath | null>(chosen);

  const picked = selection === null ? null : getNode(system, selection);
  const eligible = picked !== null && canContinueTo(node, picked);

  return (
    <Dialog title="Wybierz przejście" full onClose={onClose}>
      <div className="continuation-choice">
        <span className="continuation-chosen">
          {picked === null ? 'Zaznacz w drzewie odzywkę, do której ma przejść licytacja.'
            : eligible ? <ContinuationLabel system={system} target={selection!} node={picked} />
              : 'Ta odzywka ma inną wartość albo należy do drugiego gracza.'}
        </span>

        <Button size="small" icon={CloseIcon} onClick={onClose}>Odrzuć</Button>
        <Button size="small" variant="primary" icon={CheckIcon} disabled={!eligible} onClick={() => onPick(picked!.nodeId!)}>
          Zaakceptuj
        </Button>
      </div>

      <div className="continuation-tree">
        {/* Bez `onEdit`: to jest drzewo do czytania i wskazywania, a nie drugie miejsce, z którego da się edytować system. */}
        <BidTreeView
          system={system}
          selection={selection}
          revealKey={0}
          onSelect={setSelection}
          fade={(candidate) => !canContinueTo(node, candidate)}
        />
      </div>
    </Dialog>
  );
}

/** Dokąd prowadzi przejście: ścieżka od korzenia do wskazanej odzywki i to, co ta odzywka znaczy. */
function ContinuationLabel({ system, target, node }: { system: EditableSystem; target: NodePath; node: EditableBidNode }) {
  const steps = [...ancestorNodes(system, target), node];

  return (
    <span className="continuation-label">
      <span className="continuation-root">{system.roots[target.rootIndex]?.name?.substring(0, 3)}</span>
      {steps.map((step, index) => (
        <span key={index} className="continuation-step"><BidCard bid={step} /></span>
      ))}
      {node.condition === null || node.condition === undefined || node.condition === '' ? null : (
        <span className="continuation-meaning">{node.condition}</span>
      )}
    </span>
  );
}
