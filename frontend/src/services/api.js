import axios from 'axios';
import { API_URL } from '../config/env.js';

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('loto_numeros_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('loto_numeros_token');
      localStorage.removeItem('loto_numeros_user');
    }
    return Promise.reject(error);
  }
);
