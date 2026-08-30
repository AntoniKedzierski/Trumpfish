import { createContext } from 'react';
import type { CurrentUser } from '@/api/models';

export interface AuthContextValue {
  user: CurrentUser | null;
  /** True until the first `me` call settles, so guards can wait instead of bouncing a signed in user to the login page. */
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName: string | null) => Promise<void>;
  logout: () => Promise<void>;
  applyUser: (user: CurrentUser) => void;
}

/** Kept apart from the provider component so that file exports components only, which is what fast refresh needs. */
export const AuthContext = createContext<AuthContextValue | null>(null);
