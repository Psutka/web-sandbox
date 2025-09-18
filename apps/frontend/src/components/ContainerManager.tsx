'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material'
import { containerAPI } from '@/lib/api'
import { ContainerInfo } from '@/types/container.types'

interface ContainerManagerProps {
  onContainerSelect: (containerId: string | null) => void
  activeContainer: string | null
}

export function ContainerManager({ onContainerSelect, activeContainer }: ContainerManagerProps) {
  const [containers, setContainers] = useState<ContainerInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadContainers()
  }, [])

  const loadContainers = async () => {
    try {
      setLoading(true)
      const containerList = await containerAPI.getAllContainers()
      setContainers(containerList)
      setError(null)
    } catch (err) {
      setError('Failed to load containers')
      console.error('Error loading containers:', err)
    } finally {
      setLoading(false)
    }
  }

  const createContainer = async () => {
    console.log('Create container button clicked')
    try {
      setLoading(true)
      console.log('Setting loading to true')

      const sampleFiles = {
        'package.json': {
          file: {
            contents: JSON.stringify({
              name: 'sample-project',
              version: '1.0.0',
              scripts: {
                dev: 'node server.js'
              }
            }, null, 2)
          }
        },
        'server.js': {
          file: {
            contents: `
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>Hello from WebContainer!</h1>');
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
            `.trim()
          }
        }
      }

      console.log('Making API call to create container with files:', sampleFiles)
      const newContainer = await containerAPI.createContainer(sampleFiles)
      console.log('Container created successfully:', newContainer)

      console.log('Reloading containers list')
      await loadContainers()

      console.log('Selecting new container:', newContainer.id)
      onContainerSelect(newContainer.id)
      setError(null)
    } catch (err) {
      setError('Failed to create container')
      console.error('Error creating container:', err)
    } finally {
      console.log('Setting loading to false')
      setLoading(false)
    }
  }

  const deleteContainer = async (containerId: string) => {
    try {
      setLoading(true)
      await containerAPI.deleteContainer(containerId)
      if (activeContainer === containerId) {
        onContainerSelect(null)
      }
      await loadContainers()
      setError(null)
    } catch (err) {
      setError('Failed to delete container')
      console.error('Error deleting container:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'success'
      case 'creating':
        return 'warning'
      case 'stopped':
        return 'default'
      case 'error':
        return 'error'
      default:
        return 'default'
    }
  }

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={createContainer}
          disabled={loading}
          fullWidth
        >
          Create Container
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" sx={{ mb: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      <List>
        {containers.map((container) => (
          <ListItem
            key={container.id}
            selected={activeContainer === container.id}
            button
            onClick={() => onContainerSelect(container.id)}
            sx={{
              border: activeContainer === container.id ? '2px solid #1976d2' : '1px solid #333',
              borderRadius: 1,
              mb: 1,
            }}
          >
            <ListItemText
              primary={
                <Box display="flex" alignItems="center" gap={1}>
                  <Box component="span" sx={{ fontFamily: 'monospace' }}>
                    {container.id.substring(0, 8)}
                  </Box>
                  <Chip
                    size="small"
                    label={container.status}
                    color={getStatusColor(container.status) as any}
                  />
                </Box>
              }
              secondary={
                <>
                  {container.port && `Port: ${container.port}`}
                  {container.websocketUrl && (
                    <Box component="div" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
                      WS: {container.websocketUrl}
                    </Box>
                  )}
                </>
              }
            />
            <ListItemSecondaryAction>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteContainer(container.id)
                }}
                disabled={loading}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}

        {containers.length === 0 && !loading && (
          <ListItem>
            <ListItemText
              primary="No containers"
              secondary="Click 'Create Container' to get started"
            />
          </ListItem>
        )}
      </List>
    </Box>
  )
}