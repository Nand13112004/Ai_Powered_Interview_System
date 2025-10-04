'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import { api } from '@/lib/api'
import axios from 'axios'

interface User {
  id: string
  email: string
  name: string
  role: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, role?: string) => Promise<void>
  logout: () => void
  clearCorruptedAuth: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const isValidJWT = (token: string) => {
    try {
      // Basic JWT structure check: header.payload.signature
      const parts = token.split('.')
      if (parts.length !== 3) return false
      
      // Check if each part is base64 encoded
      parts.forEach(part => {
        if (!part || part.length === 0) throw new Error('Invalid part')
        // Basic base64 check
        if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error('Invalid encoding')
      })
      
      return true
    } catch {
      return false
    }
  }

  const checkAuth = async () => {
    try {
      const token = Cookies.get('token')
      if (!token) {
        setUser(null)
        setLoading(false)
        return
      }

      // Validate token format before making API call
      if (!isValidJWT(token)) {
        console.error('AuthContext: Invalid JWT token format, removing token')
        Cookies.remove('token')
        setUser(null)
        setLoading(false)
        return
      }

      console.log('AuthContext: Checking auth with valid token:', token.substring(0, 20) + '...')
      const response = await api.get('/auth/me')
      setUser(response.data.user)
      console.log('AuthContext: Auth successful, user set:', response.data.user)
    } catch (error: any) {
      console.error('Auth check failed:', error)
      console.error('Auth error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
      Cookies.remove('token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      const { user, token } = response.data
      
      Cookies.set('token', token, { expires: 7 })
      setUser(user)
      if (user.role === 'interviewer') {
        router.push('/interviewer/dashboard')
      } else {
        router.push('/dashboard')
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed')
    }
  }

  const register = async (name: string, email: string, password: string, role = 'candidate') => {
    try {
      const response = await api.post('/auth/register', { 
        name, 
        email, 
        password, 
        role 
      })
      const { user, token } = response.data
      
      Cookies.set('token', token, { expires: 7 })
      setUser(user)
      router.push('/dashboard')
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed')
    }
  }

  const logout = () => {
    Cookies.remove('token')
    setUser(null)
    router.push('/')
  }

  const clearCorruptedAuth = () => {
    console.log('Clearing corrupted authentication data...')
    Cookies.remove('token')
    setUser(null)
    setLoading(false)
    router.push('/login')
  }

  const generateQuestions = async (role: string, level: string) => {
    try {
      const res = await axios.post('http://localhost:5000/api/generate-questions', { role, level });
      return res.data.questions;
    } catch (error) {
      console.error('Error generating questions:', error);
      return [];
    }
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    clearCorruptedAuth,
    generateQuestions
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
