'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Box,
  TextField,
  Typography,
  Paper,
} from '@mui/material'
import { ContainerWebSocket } from '@/lib/websocket'

interface TerminalProps {
  containerId: string | null
}

interface TerminalLine {
  type: 'input' | 'output' | 'error'
  content: string
  timestamp: Date
}

export function Terminal({ containerId }: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [input, setInput] = useState('')
  const [ws, setWs] = useState<ContainerWebSocket | null>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerId) {
      const websocket = new ContainerWebSocket()
      const socket = websocket.connect(containerId)

      socket.on('joined-container', (data) => {
        console.log('Terminal: Joined container event received:', data)
        addLine('output', `Connected to container ${data.containerId}`)
      })

      socket.on('terminal-output', (data) => {
        console.log('Terminal: Terminal output received:', data)
        addLine('output', data.output)
      })

      socket.on('process-result', (data) => {
        console.log('Terminal: Process result received:', data)
        addLine('output', data.result.output || `Process started with PID: ${data.result.pid}`)
      })

      socket.on('error', (error) => {
        console.log('Terminal: Error event received:', error)
        addLine('error', error.message)
      })

      setWs(websocket)

      return () => {
        websocket.disconnect()
        setWs(null)
      }
    } else {
      setWs(prev => {
        if (prev) {
          prev.disconnect()
        }
        return null
      })
      setLines([])
    }
  }, [containerId])

  useEffect(() => {
    // Auto-scroll to bottom
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [lines])

  const addLine = (type: 'input' | 'output' | 'error', content: string) => {
    setLines(prev => [...prev, {
      type,
      content,
      timestamp: new Date()
    }])
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      const command = input.trim()
      console.log('Terminal: Command entered:', command)
      addLine('input', `$ ${command}`)

      // Parse command
      const parts = command.split(' ')
      const cmd = parts[0]
      const args = parts.slice(1)

      if (ws) {
        console.log('Terminal: WebSocket connected, processing command:', cmd, 'with args:', args)
        if (['ls', 'pwd', 'cat', 'echo', 'mkdir', 'rm', 'touch'].includes(cmd)) {
          // File system commands - enhance ls to show file types
          let commandToSend = cmd
          let argsToSend = args

          if (cmd === 'ls' && args.length === 0) {
            // Use ls -la for better directory/file distinction
            argsToSend = ['-la']
          }

          console.log('Terminal: Sending process operation for:', commandToSend, 'with args:', argsToSend)
          ws.sendProcessOperation({
            type: 'spawn',
            command: commandToSend,
            args: argsToSend
          })
        } else {
          // Send as terminal input
          console.log('Terminal: Sending terminal input for:', command)
          ws.sendTerminalInput(command)
        }
      } else {
        console.log('Terminal: WebSocket not connected')
        addLine('error', 'Not connected to container')
      }

      setInput('')
    }
  }

  const getLineColor = (type: string) => {
    switch (type) {
      case 'input':
        return '#4CAF50'
      case 'error':
        return '#f44336'
      case 'output':
      default:
        return '#ffffff'
    }
  }

  if (!containerId) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={200}>
        <Typography color="text.secondary">
          Select a container to use terminal
        </Typography>
      </Box>
    )
  }

  return (
    <Box height="100%">
      <Paper
        ref={terminalRef}
        sx={{
          backgroundColor: '#0a0a0a',
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: '14px',
          height: '450px',
          overflow: 'auto',
          p: 1,
          mb: 1,
        }}
      >
        {lines.map((line, index) => (
          <Box
            key={index}
            sx={{
              color: getLineColor(line.type),
              marginBottom: '2px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {line.content}
          </Box>
        ))}
      </Paper>

      <TextField
        fullWidth
        size="small"
        placeholder="Enter command..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={!containerId}
        InputProps={{
          sx: {
            fontFamily: 'monospace',
            backgroundColor: '#1a1a1a',
            '& input': {
              color: '#ffffff',
            },
          },
        }}
      />
    </Box>
  )
}