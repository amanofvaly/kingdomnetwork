const BASE = '/api';

let token = localStorage.getItem('kn.token');

export const setToken = (next) => {
  token = next;
  if (next) localStorage.setItem('kn.token', next);
  else localStorage.removeItem('kn.token');
};

export const getToken = () => token;

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
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
    throw new ApiError(payload?.message ?? 'Something went wrong.', res.status, payload?.data);
  }

  return payload.data;
};

export const api = {
  get: (path, opts) => request(path, opts),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),

  /**
   * Send one file as the whole request body, with its name and destination in
   * headers. The server reads it straight through with a hard size ceiling, so
   * there is no multipart envelope to build here.
   *
   * XMLHttpRequest rather than fetch, because it is still the only way to get
   * upload progress in a browser.
   */
  upload: (path, file, { onProgress, headers = {} } = {}) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', BASE + path);
      xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('x-filename', file.name ?? 'file');
      if (token) xhr.setRequestHeader('authorization', `Bearer ${token}`);
      for (const [key, value] of Object.entries(headers)) {
        if (value != null) xhr.setRequestHeader(key, String(value));
      }

      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        let payload = null;
        try {
          payload = JSON.parse(xhr.responseText);
        } catch {
          return reject(new ApiError('The server returned an unexpected response.', xhr.status));
        }
        if (xhr.status >= 400 || payload?.success === false) {
          if (xhr.status === 401) setToken(null);
          return reject(new ApiError(payload?.message ?? 'That upload failed.', xhr.status));
        }
        resolve(payload.data);
      };
      xhr.onerror = () => reject(new ApiError('Could not reach the server.', 0));
      xhr.send(file);
    }),
};
