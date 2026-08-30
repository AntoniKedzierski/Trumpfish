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

async function send(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${apiRoot}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...init?.headers },
  });

  if (!response.ok) {
    if (response.status === 401) {
      onUnauthorized?.();
    }

    throw new ApiError(response.status, (await response.text()) || `${response.status} ${response.statusText}`);
  }

  return response;
}

export async function getJson<T>(path: string): Promise<T> {
  return (await send(path)).json() as Promise<T>;
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
