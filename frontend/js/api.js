/**
 * API Client — Fetch wrapper with auth headers and error handling
 */
const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE;
  }

  getToken() {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken() {
    return localStorage.getItem('refreshToken');
  }

  setTokens(accessToken, refreshToken) {
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  }

  clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  getUser() {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  }

  setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };

    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      // Handle token expired
      if (response.status === 401 && data.code === 'TOKEN_EXPIRED') {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.getToken()}`;
          const retryResponse = await fetch(url, { ...options, headers });
          return await retryResponse.json();
        } else {
          this.clearTokens();
          window.location.href = '/login';
          return data;
        }
      }

      if (!response.ok && response.status === 401) {
        this.clearTokens();
        window.location.href = '/login';
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  async refreshToken() {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();
      if (data.success) {
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Convenience methods
  get(endpoint) { return this.request(endpoint); }

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // File upload (no JSON content-type)
  async upload(endpoint, formData) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(url, { method: 'POST', headers, body: formData });
      return await response.json();
    } catch (error) {
      return { success: false, message: 'Upload failed.' };
    }
  }

  // Download file
  async download(endpoint, filename) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(url, { headers });
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename || 'download';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Download error:', error);
    }
  }
}

const api = new ApiClient();
