import axios from 'axios';
import { API_URL } from '../config/env.js';
import { clearSession, getToken, getUser, saveSession } from '../features/auth/session.js';

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const isLoginRequest = error.config?.url?.endsWith('/auth/login');

    if (status === 401 && !isLoginRequest) {
      // Sesión vencida, usuario desactivado o contraseña cambiada en otro lugar: se vuelve al login.
      clearSession();
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }

    if (status === 403 && error.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED') {
      const user = getUser();
      if (user) saveSession({ token: getToken(), user: { ...user, debeCambiarPassword: true } });
      if (window.location.pathname !== '/cambiar-password') window.location.assign('/cambiar-password');
    }

    return Promise.reject(error);
  }
);
