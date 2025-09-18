import { io, Socket } from 'socket.io-client'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'

export class ContainerWebSocket {
  private socket: Socket | null = null
  private containerId: string | null = null

  connect(containerId: string) {
    if (this.socket) {
      this.disconnect()
    }

    this.containerId = containerId
    this.socket = io(`${WS_URL}/container`)

    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.joinContainer(containerId)
    })

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
    })

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error)
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.containerId = null
    }
  }

  private joinContainer(containerId: string) {
    if (this.socket) {
      this.socket.emit('join-container', { containerId })
    }
  }

  sendFileSystemOperation(operation: any) {
    if (this.socket && this.containerId) {
      this.socket.emit('fs-operation', operation)
    }
  }

  sendProcessOperation(operation: any) {
    if (this.socket && this.containerId) {
      this.socket.emit('process-operation', operation)
    }
  }

  sendTerminalInput(input: string) {
    if (this.socket && this.containerId) {
      this.socket.emit('terminal-input', { input })
    }
  }

  onMessage(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback)
    }
  }

  offMessage(event: string, callback?: (data: any) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback)
      } else {
        this.socket.off(event)
      }
    }
  }
}