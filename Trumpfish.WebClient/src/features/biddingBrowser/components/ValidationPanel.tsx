import type { ValidationIssue, ValidationSeverity } from '@/api/models';

/** The severity travels as its enum name; the badge sits next to Polish messages, so it is labelled to match. */
const severityLabels: Record<ValidationSeverity, string> = { Info: 'Info', Warning: 'Ostrzeżenie', Error: 'Błąd' };

interface ValidationPanelProps {
  issues: ValidationIssue[] | null;
  onSelectIssue: (issue: ValidationIssue) => void;
  /** Writes into the bid's ranges what its description already states. */
  onRepairRanges: (issue: ValidationIssue) => void;
  /** Rewrites the bid's description to say what the bidding actually implies. */
  onRepairCondition: (issue: ValidationIssue) => void;
  onClose: () => void;
}

export function ValidationPanel({ issues, onSelectIssue, onRepairRanges, onRepairCondition, onClose }: ValidationPanelProps) {
  if (issues === null) {
    return null;
  }

  return (
    <section className="validation">
      <header>
        <span>Wynik walidacji {issues.length === 0 ? '- brak problemów.' : `- ${issues.length} problem(ów).`}</span>
        <button type="button" onClick={onClose}>Zamknij</button>
      </header>

      <ul>
        {issues.map((issue, index) => (
          <li key={index}>
            <button type="button" className={`issue ${issue.severity.toLowerCase()}`} onClick={() => onSelectIssue(issue)} title="Pokaż odzywkę w drzewku">
              <strong>{severityLabels[issue.severity] ?? issue.severity}</strong>
              <span>{issue.message}</span>
              <span className="issue-path">{issue.path}</span>
              {issue.conventionContext && <span className="issue-convention">{issue.conventionContext}</span>}
            </button>

            {/* The two repairs sit on opposite sides of the same disagreement, so at most one of them is ever available. */}
            <button
              type="button"
              className="issue-repair"
              disabled={!issue.repair}
              onClick={() => onRepairRanges(issue)}
              title={issue.repair
                ? `Wpisuje w pola odzywki to, co mówi jej opis: ${issue.repair.bound === 'lower' ? 'dolny' : 'górny'} limit = ${issue.repair.value}.`
                : 'Opis nie mówi tu nic, czego nie ma już w polach odzywki.'}
            >
              Napraw warunek
            </button>

            <button
              type="button"
              className="issue-repair"
              disabled={!issue.conditionRepair}
              onClick={() => onRepairCondition(issue)}
              title={issue.conditionRepair
                ? `Przepisuje opis na to, co wynika z licytacji: „${issue.conditionRepair}”.`
                : 'Opisu nie da się tu poprawić automatycznie.'}
            >
              Napraw opis
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
