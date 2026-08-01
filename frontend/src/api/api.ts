import axios from 'axios'

const isBrowser = () => typeof window !== 'undefined'

const normalizeApiUrl = (value: string) => {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return normalizedValue
  }

  if (isBrowser() && window.location.protocol === 'https:') {
    return normalizedValue.replace(/^http:\/\//i, 'https://')
  }

  return normalizedValue
}

const resolveRuntimeApiUrl = () => {
  if (!isBrowser()) {
    return ''
  }

  const { hostname, origin } = window.location

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return ''
  }

  return origin
}

const rawApiUrl =
  typeof import.meta.env.VITE_API_URL === 'string'
    ? normalizeApiUrl(import.meta.env.VITE_API_URL)
    : ''

export const API_URL = rawApiUrl || resolveRuntimeApiUrl() || 'http://localhost:3000'
export const AUTH_TOKEN_STORAGE_KEY = 'noir-blanc.auth.token'
const AUTH_USER_STORAGE_KEY = 'noir-blanc.auth.user'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      typeof window !== 'undefined'
    ) {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY)

      if (window.location.pathname.startsWith('/admin')) {
        window.location.replace('/?sesion=expirada')
      }
    }

    return Promise.reject(error)
  },
)

export const getApiErrorMessage = (
  error: unknown,
  fallback = 'Ocurrio un error inesperado.',
): string => {
  return getApiErrorMessages(error, fallback).join(' ')
}

export const getApiErrorMessages = (
  error: unknown,
  fallback = 'Ocurrio un error inesperado.',
): string[] => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message

    if (Array.isArray(message)) {
      return message
        .map((item) => String(item).trim())
        .filter(Boolean)
    }

    if (typeof message === 'string') {
      return [message]
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return [error.message]
  }

  return [fallback]
}

export default api
