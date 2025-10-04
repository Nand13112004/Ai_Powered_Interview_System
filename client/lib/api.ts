import axios from 'axios'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('token')
    console.log('API Request - Token check:', {
      hasToken: !!token,
      tokenLength: token?.length,
      tokenStart: token?.substring(0, 20),
      url: config.url,
      method: config.method
    })
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      console.log('Authorization header set:', config.headers.Authorization.substring(0, 30) + '...')
    } else {
      console.log('No token found, request will fail authentication')
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log('Authentication token expired or invalid, clearing token')
      Cookies.remove('token')
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

