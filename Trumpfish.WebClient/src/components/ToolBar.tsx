import '@/styles/toolbar.css';

/**
 * The one bar every tool view is driven from: what can be done on the left, what is going on on the right.
 */
/*
 * There were three of these - the browser's commands, the simulator's settings, a strip of status above both - and they
 * drifted apart in height, in type size and in which end the buttons sat at. One component now, so a bar cannot be built
 * any other way: the commands start at the left edge like a sentence, and the state of the view - busy, an error, how
 * many rows came back - is read at the other end.
 *
 * The bar does not scroll: the view it belongs to is framed to the window (see `AppLayout.css`) and its content scrolls
 * underneath. On a narrow screen the commands keep their marks and drop their words rather than wrapping onto a second
 * row, which is what keeps this to one line on a phone.
 */
export function ToolBar({ children, status }: { children: React.ReactNode; status?: React.ReactNode }) {
  return (
    <div className="toolbar">
      <div className="toolbar-commands">{children}</div>
      {/* Mounted whether or not it has anything to say: a live region announced into existence is one screen readers stay quiet about. */}
      <div className="toolbar-status" role="status">{status}</div>
    </div>
  );
}
