const BASE = '/api';

let token = localStorage.getItem('kn.token');

export const setToken = (next) => {
  token = next;
  if (next) localStorage.setItem('kn.token', next);
  else localStorage.removeItem('kn.token');
};

export const getToken = () => token;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const request = async (path, { method = 'GET', body, signal } = {}) => {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, signal, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    throw new ApiError('The server returned an unexpected response.', res.status);
  }

  if (!res.ok || payload?.success === false) {
    if (res.status === 401) setToken(null);
    throw new ApiError(payload?.message ?? 'Something went wrong.', res.status);
  }

  return payload.data;
};

export const api = {
  get: (path, opts) => request(path, opts),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
};
