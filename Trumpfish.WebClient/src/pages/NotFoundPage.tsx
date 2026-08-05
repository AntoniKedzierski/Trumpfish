import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="home">
      <h1>Nie znaleziono strony</h1>
      <Link to="/" className="back-link">← Wróć do narzędzi</Link>
    </div>
  );
}
