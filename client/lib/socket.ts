import { io, Socket } from 'socket.io-client'
import Cookies from 'js-cookie'

class SocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Function[]> = new Map()

  connect() {
    if (this.socket?.connected) {
      return this.socket
    }

    const token = Cookies.get('token')
    if (!token) {
      throw new Error('No authentication token found')
    }

    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000'
    
    this.socket = io(WS_URL, {
      auth: {
        token
      },
      transports: ['websocket', 'polling']
    })

    this.socket.on('connect', () => {
      console.log('Connected to server')
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason)
    })

    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn('Socket not connected')
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)

    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  off(event: string, callback?: Function) {
    if (callback) {
      const listeners = this.listeners.get(event) || []
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    } else {
      this.listeners.delete(event)
    }

    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback)
      } else {
        this.socket.removeAllListeners(event)
      }
    }
  }

  isConnected() {
    return this.socket?.connected || false
  }
}

export const socketService = new SocketService()
export default socketService
