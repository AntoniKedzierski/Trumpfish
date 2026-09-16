import { Link } from 'react-router-dom';
import type { ToolDescriptor } from '@/tools/toolsRegistry';
import { tools } from '@/tools/toolsRegistry';
import './HomePage.css';

export function HomePage() {
  return (
    <div className="home">
      {/* The account now lives in the shared top bar, so the page header is back to being just a title. */}
      <header>
        <img src="/images/card_icon.png" alt="" />
        <div>
          <h1>Trumpfish</h1>
          <p>Narzędzia brydżowe: systemy licytacyjne, analiza i gra z silnikiem.</p>
        </div>
      </header>

      {/*
        * A card is named and drawn exactly as the drawer names and draws the same tool. The cards used to carry longer
        * titles of their own, which left the user matching "Ćwiczenie licytacji" on this page against "Z botami" in the
        * navigation and working out that they are one tool.
        */}
      <section className="tool-grid">
        {tools.map((tool) =>
          tool.enabled ? (
            <Link key={tool.id} to={tool.route} className="tool-card">
              <ToolFace tool={tool} />
            </Link>
          ) : (
            <div key={tool.id} className="tool-card disabled">
              <ToolFace tool={tool} />
            </div>
          ),
        )}
      </section>
    </div>
  );
}

function ToolFace({ tool }: { tool: ToolDescriptor }) {
  const Glyph = tool.icon;

  return (
    <>
      <h2>
        <Glyph />
        <span>{tool.navLabel}</span>
      </h2>
      <p>{tool.description}</p>
    </>
  );
}
