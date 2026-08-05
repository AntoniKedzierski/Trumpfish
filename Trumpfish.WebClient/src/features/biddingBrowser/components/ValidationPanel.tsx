import type { ValidationIssue } from '@/api/models';

interface ValidationPanelProps {
  issues: ValidationIssue[] | null;
  onClose: () => void;
}

export function ValidationPanel({ issues, onClose }: ValidationPanelProps) {
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
          <li key={index} className={`issue ${issue.severity.toLowerCase()}`}>
            <strong>{issue.severity}</strong>
            <span>{issue.message}</span>
            <span className="issue-path">{issue.path}</span>
            {issue.conventionContext && <span className="issue-convention">{issue.conventionContext}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
