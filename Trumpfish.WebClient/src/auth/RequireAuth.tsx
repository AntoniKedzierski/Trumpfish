import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './useAuth';

/**
 * Gate for every routed view that needs an account. Signing in always lands on the tool list rather than wherever the visitor
 * happened to be: the common case is signing out from the account page, and being dropped straight back into settings on the
 * next sign in is not where anyone wants to start.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="auth-pending">Sprawdzam sesję…</div>;
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
