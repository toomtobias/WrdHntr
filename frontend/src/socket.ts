import { io, Socket } from 'socket.io-client'

// Get socket URL - use same origin in production, localhost in development
const SOCKET_URL = import.meta.env.PROD
  ? window.location.origin
  : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001')

// Create socket instance (don't connect immediately)
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling']
})

// Socket connection helpers
export function connectSocket(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve()
      return
    }

    socket.connect()

    socket.once('connect', () => {
      console.log('Socket connected:', socket.id)
      resolve()
    })

    socket.once('connect_error', (error) => {
      console.error('Socket connection error:', error)
      reject(error)
    })

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!socket.connected) {
        reject(new Error('Connection timeout'))
      }
    }, 10000)
  })
}

export function disconnectSocket(): void {
  if (socket.connected) {
    socket.disconnect()
  }
}
