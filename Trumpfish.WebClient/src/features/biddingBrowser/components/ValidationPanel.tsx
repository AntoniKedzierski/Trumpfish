import type { ValidationIssue } from '@/api/models';

interface ValidationPanelProps {
  issues: ValidationIssue[] | null;
  onSelectIssue: (issue: ValidationIssue) => void;
  onClose: () => void;
}

export function ValidationPanel({ issues, onSelectIssue, onClose }: ValidationPanelProps) {
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
              <strong>{issue.severity}</strong>
              <span>{issue.message}</span>
              <span className="issue-path">{issue.path}</span>
              {issue.conventionContext && <span className="issue-convention">{issue.conventionContext}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
