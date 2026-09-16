const apiRoot = '/api';

export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let onUnauthorized: (() => void) | null = null;

/** Lets the auth provider drop the signed in user the moment any call comes back 401, so an expired cookie routes to the login page. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/**
 * The antiforgery token the server expects on every mutating call, held for the lifetime of the page. It is bound to the
 * signed in account, so it stops being valid the moment somebody signs in or out - which is what `forgetCsrfToken` is for.
 */
let csrfToken: string | null = null;

/** The request in flight, so a burst of calls on a cold page waits on one token rather than fetching one each. */
let csrfRequest: Promise<string> | null = null;

/** Drops the stored token. Call it after anything that changes who is signed in; the next mutating call fetches a fresh one. */
export function forgetCsrfToken(): void {
  csrfToken = null;
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken !== null) {
    return csrfToken;
  }

  csrfRequest ??= fetch(`${apiRoot}/auth/csrf`, { headers: { Accept: 'application/json' } })
    .then((response) => response.json() as Promise<{ token: string }>)
    .then(({ token }) => {
      csrfToken = token;
      return token;
    })
    .finally(() => {
      csrfRequest = null;
    });

  return csrfRequest;
}

/** Everything but these carries an antiforgery token, matching the methods the server's AntiforgeryFilter lets through. */
const safeMethods = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];

/** Plain headers rather than the three shapes `RequestInit` allows, which is all this client ever passes and all it has to merge. */
type Init = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };

async function send(path: string, init?: Init, retryStaleToken = true): Promise<Response> {
  const method = init?.method ?? 'GET';

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (!safeMethods.includes(method)) {
    headers['X-CSRF-TOKEN'] = await getCsrfToken();
  }

  const response = await fetch(`${apiRoot}${path}`, { ...init, headers: { ...headers, ...init?.headers } });

  if (!response.ok) {
    if (response.status === 401) {
      onUnauthorized?.();
    }

    // The server marks a rejected antiforgery token with this header, which is what tells it apart from a bad request the
    // user has to do something about. The stored token goes stale whenever the signed in identity changes - a sign out in
    // another tab, say - so it is worth one silent retry with a fresh one before the call is reported as failed.
    if (retryStaleToken && response.headers.get('X-Antiforgery') !== null) {
      forgetCsrfToken();
      return send(path, init, false);
    }

    throw new ApiError(response.status, (await response.text()) || `${response.status} ${response.statusText}`);
  }

  return response;
}

export async function getJson<T>(path: string): Promise<T> {
  return (await send(path)).json() as Promise<T>;
}

/** For a PUT that answers 204: there is no body to parse, and asking for one would throw. */
export async function putNoContent(path: string, body: unknown): Promise<void> {
  await send(path, { method: 'PUT', body: JSON.stringify(body) });
}

export async function putJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  return (await send(path, { method: 'PUT', body: JSON.stringify(body) })).json() as Promise<TResponse>;
}

export async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  return (await send(path, { method: 'POST', body: JSON.stringify(body) })).json() as Promise<TResponse>;
}

/** For endpoints that answer 204: there is no body to parse, and asking for one would throw. */
export async function postNoContent(path: string, body: unknown): Promise<void> {
  await send(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function remove(path: string): Promise<void> {
  await send(path, { method: 'DELETE' });
}

/** For a delete that answers with the list it just changed, so the caller does not need a second round trip to see it. */
export async function deleteJson<TResponse>(path: string): Promise<TResponse> {
  return (await send(path, { method: 'DELETE' })).json() as Promise<TResponse>;
}

/** For endpoints that answer 204 on one path and a body on another, so the caller decides what to do with the response. */
export async function getResponse(path: string): Promise<Response> {
  return send(path);
}
