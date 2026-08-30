import { ApiError, getJson, postJson, postNoContent, putJson } from './client';
import type { CurrentUser } from './models';

const route = '/auth';

/** Returns null when nobody is signed in, so callers can treat "anonymous" as an answer rather than an error. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await getJson<CurrentUser>(`${route}/me`);
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 401) {
      return null;
    }

    throw reason;
  }
}

export function login(username: string, password: string): Promise<CurrentUser> {
  return postJson<CurrentUser>(`${route}/login`, { username, password });
}

export function register(username: string, password: string, displayName: string | null): Promise<CurrentUser> {
  return postJson<CurrentUser>(`${route}/register`, { username, password, displayName });
}

export function logout(): Promise<void> {
  return postNoContent(`${route}/logout`, {});
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return postNoContent(`${route}/password`, { currentPassword, newPassword });
}

export function updateProfile(displayName: string | null): Promise<CurrentUser> {
  return putJson<CurrentUser>(`${route}/profile`, { displayName });
}
