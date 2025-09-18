'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
} from '@mui/material'
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  Add as AddIcon,
  CreateNewFolder as CreateFolderIcon,
} from '@mui/icons-material'
import { webContainerAPI } from '@/lib/api'

interface FileExplorerProps {
  containerId: string | null
}

interface FileItem {
  name: string
  type: 'file' | 'directory'
  path: string
}

export function FileExplorer({ containerId }: FileExplorerProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [currentPath, setCurrentPath] = useState('/')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createDialog, setCreateDialog] = useState<{
    open: boolean
    type: 'file' | 'directory'
    name: string
  }>({
    open: false,
    type: 'file',
    name: ''
  })

  const loadFiles = useCallback(async (path: string) => {
    if (!containerId) return

    try {
      setLoading(true)
      const result = await webContainerAPI.readdir(containerId, path)
      setFiles(result.files || [])
      setError(null)
    } catch (err) {
      setError('Failed to load files')
      console.error('Error loading files:', err)
    } finally {
      setLoading(false)
    }
  }, [containerId])

  useEffect(() => {
    if (containerId) {
      loadFiles(currentPath)
    } else {
      setFiles([])
    }
  }, [containerId, currentPath, loadFiles])

  const handleFileClick = (file: FileItem) => {
    if (file.type === 'directory') {
      const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`
      setCurrentPath(newPath)
    }
  }

  const navigateUp = () => {
    if (currentPath !== '/') {
      const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
      setCurrentPath(parentPath)
    }
  }

  const handleCreate = async () => {
    if (!containerId || !createDialog.name) return

    try {
      const fullPath = currentPath === '/' 
        ? `/${createDialog.name}` 
        : `${currentPath}/${createDialog.name}`

      if (createDialog.type === 'file') {
        await webContainerAPI.writeFile(containerId, fullPath, '')
      } else {
        await webContainerAPI.mkdir(containerId, fullPath)
      }

      setCreateDialog({ open: false, type: 'file', name: '' })
      await loadFiles(currentPath)
      setError(null)
    } catch (err) {
      setError(`Failed to create ${createDialog.type}`)
      console.error(`Error creating ${createDialog.type}:`, err)
    }
  }

  if (!containerId) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={200}>
        <Typography color="text.secondary">
          Select a container to explore files
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="between" sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', flexGrow: 1 }}>
          {currentPath}
        </Typography>
        <Box>
          <IconButton
            size="small"
            onClick={() => setCreateDialog({ open: true, type: 'file', name: '' })}
            title="Create File"
          >
            <AddIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setCreateDialog({ open: true, type: 'directory', name: '' })}
            title="Create Directory"
          >
            <CreateFolderIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ maxHeight: '480px', overflow: 'auto' }}>
        <List dense>
          {currentPath !== '/' && (
            <ListItem button onClick={navigateUp}>
              <ListItemIcon>
                <FolderIcon />
              </ListItemIcon>
              <ListItemText primary=".." />
            </ListItem>
          )}

          {files.map((file) => (
            <ListItem
              key={file.name}
              button
              onClick={() => handleFileClick(file)}
            >
              <ListItemIcon>
                {file.type === 'directory' ? <FolderIcon /> : <FileIcon />}
              </ListItemIcon>
              <ListItemText
                primary={file.name}
                sx={{
                  '& .MuiListItemText-primary': {
                    fontFamily: file.type === 'file' ? 'monospace' : 'inherit'
                  }
                }}
              />
            </ListItem>
          ))}

          {files.length === 0 && !loading && (
            <ListItem>
              <ListItemText
                primary="No files"
                secondary="This directory is empty"
              />
            </ListItem>
          )}
        </List>
      </Box>

      <Dialog 
        open={createDialog.open} 
        onClose={() => setCreateDialog({ open: false, type: 'file', name: '' })}
      >
        <DialogTitle>
          Create {createDialog.type === 'file' ? 'File' : 'Directory'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            variant="outlined"
            value={createDialog.name}
            onChange={(e) => setCreateDialog(prev => ({ ...prev, name: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog({ open: false, type: 'file', name: '' })}>
            Cancel
          </Button>
          <Button onClick={handleCreate} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}