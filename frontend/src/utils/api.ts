const BASE_URL = '/api';

export async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Auto-set content type only if body is not a FormData (which browser sets automatically)
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  const contentType = response.headers.get('Content-Type');
  if (contentType && (contentType.includes('application/json') || contentType.includes('text/json'))) {
    return response.json();
  }

  return response;
}
