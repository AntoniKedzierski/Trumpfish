import { Children } from 'react';
import './PageStatus.css';

/**
 * The strip a tool view uses to say what it is doing - busy, a notice, an error - and to carry the commands that belong to
 * the session rather than to the content.
 */
/*
 * It replaced the page headers, which repeated the tool's name under the tab that already named it. What was worth keeping
 * from them was the status line, so that is all this is.
 *
 * The live region is mounted whether or not it has anything to say. A region announced into existence is a region most
 * screen readers stay quiet about, so instead the strip collapses to nothing while it is empty and keeps its place in the
 * document.
 */
export function PageStatus({ children, actions }: { children?: React.ReactNode; actions?: React.ReactNode }) {
  const spoken = Children.toArray(children).length > 0;
  const commands = Children.toArray(actions);

  return (
    <div className={spoken || commands.length > 0 ? 'page-strip' : 'page-strip empty'}>
      <div className="page-status" role="status">
        {children}
      </div>
      {commands.length === 0 ? null : <div className="page-strip-actions">{actions}</div>}
    </div>
  );
}
