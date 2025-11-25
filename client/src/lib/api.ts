import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { authStore } from '../store/authStore';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken } = authStore.getState();
  if (accessToken) {
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    }
    (config.headers as AxiosHeaders).set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !(originalRequest as any)._retry) {
      (originalRequest as any)._retry = true;
      const { refreshToken, setTokens, clearTokens } = authStore.getState();
      if (!refreshToken) {
        clearTokens();
        return Promise.reject(error);
      }
      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        setTokens(data.accessToken, data.refreshToken);
        if (!originalRequest.headers) {
          originalRequest.headers = new AxiosHeaders();
        }
        (originalRequest.headers as AxiosHeaders).set('Authorization', `Bearer ${data.accessToken}`);
        return api(originalRequest);
      } catch (refreshError) {
        clearTokens();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export default api;

