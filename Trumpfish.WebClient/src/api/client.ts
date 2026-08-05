const apiRoot = '/api';

export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${apiRoot}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...init?.headers },
  });

  if (!response.ok) {
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

export async function remove(path: string): Promise<void> {
  await send(path, { method: 'DELETE' });
}
