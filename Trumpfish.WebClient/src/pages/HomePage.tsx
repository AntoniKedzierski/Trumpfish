import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { tools } from '@/tools/toolsRegistry';
import './HomePage.css';

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="home">
      <header>
        <img src="/images/card_icon.png" alt="" />
        <div>
          <h1>Trumpfish</h1>
          <p>Narzędzia brydżowe: systemy licytacyjne, analiza i gra z silnikiem.</p>
        </div>
        {user !== null && (
          <Link to="/account" className="account-chip">
            <span className="name">{user.displayName ?? user.username}</span>
            <span className="role">{user.isAdmin ? 'Administrator' : 'Konto'}</span>
          </Link>
        )}
      </header>

      <section className="tool-grid">
        {tools.map((tool) =>
          tool.enabled ? (
            <Link key={tool.id} to={tool.route} className="tool-card">
              <h2>{tool.title}</h2>
              <p>{tool.description}</p>
            </Link>
          ) : (
            <div key={tool.id} className="tool-card disabled">
              <h2>{tool.title}</h2>
              <p>{tool.description}</p>
            </div>
          ),
        )}
      </section>
    </div>
  );
}
