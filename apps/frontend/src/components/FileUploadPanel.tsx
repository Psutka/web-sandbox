'use client'

import { useState } from 'react'
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  LinearProgress,
  Chip,
} from '@mui/material'
import { CloudUpload, Clear } from '@mui/icons-material'
import { webContainerAPI } from '@/lib/api'

interface FileUploadPanelProps {
  containerId: string | null
}

export function FileUploadPanel({ containerId }: FileUploadPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [targetPath, setTargetPath] = useState('/workspace/')
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setUploadMessage(null)
      // Auto-populate target path with filename if only directory is specified
      if (targetPath.endsWith('/')) {
        setTargetPath(targetPath + file.name)
      }
    }
  }

  const handleClearFile = () => {
    setSelectedFile(null)
    setUploadMessage(null)
    // Reset file input
    const fileInput = document.getElementById('file-upload') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !containerId || !targetPath) {
      setUploadMessage({ type: 'error', text: 'Please select a file, container, and target path' })
      return
    }

    setUploading(true)
    setUploadMessage(null)

    try {
      let fileContents: string
      let encoding: 'utf8' | 'base64' = 'utf8'

      // Handle binary files by converting to base64
      if (selectedFile.type.startsWith('image/') ||
          selectedFile.type === 'application/zip' ||
          selectedFile.type === 'application/octet-stream' ||
          selectedFile.type === 'application/pdf' ||
          selectedFile.name.match(/\.(zip|tar|gz|jpg|jpeg|png|gif|pdf|exe|bin)$/i)) {
        const arrayBuffer = await selectedFile.arrayBuffer()
        fileContents = Buffer.from(arrayBuffer).toString('base64')
        encoding = 'base64'
      } else {
        // Handle text files
        fileContents = await selectedFile.text()
        encoding = 'utf8'
      }

      const result = await webContainerAPI.upload(
        containerId,
        selectedFile.name,
        targetPath,
        fileContents,
        encoding
      )

      setUploadMessage({
        type: 'success',
        text: `File "${selectedFile.name}" uploaded successfully to ${targetPath}`
      })

      // Clear the file selection after successful upload
      handleClearFile()
      setTargetPath('/workspace/')

    } catch (error) {
      console.error('Upload error:', error)
      setUploadMessage({
        type: 'error',
        text: `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        p: 2,
        zIndex: 1000,
        borderRadius: '8px 8px 0 0',
        backgroundColor: 'background.paper'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ minWidth: 'fit-content' }}>
          File Upload
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <input
            id="file-upload"
            type="file"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={!containerId || uploading}
          />
          <label htmlFor="file-upload">
            <Button
              variant="outlined"
              component="span"
              startIcon={<CloudUpload />}
              disabled={!containerId || uploading}
            >
              Choose File
            </Button>
          </label>

          {selectedFile && (
            <Chip
              label={`${selectedFile.name} (${formatFileSize(selectedFile.size)})`}
              onDelete={handleClearFile}
              deleteIcon={<Clear />}
              variant="outlined"
              color="primary"
            />
          )}
        </Box>

        <TextField
          label="Target Path"
          value={targetPath}
          onChange={(e) => setTargetPath(e.target.value)}
          placeholder="/workspace/filename.txt"
          size="small"
          sx={{ minWidth: 250 }}
          disabled={uploading}
        />

        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!selectedFile || !containerId || !targetPath || uploading}
          startIcon={uploading ? null : <CloudUpload />}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>

        {!containerId && (
          <Typography variant="body2" color="text.secondary">
            Select a container to enable file upload
          </Typography>
        )}
      </Box>

      {uploading && (
        <LinearProgress sx={{ mt: 1 }} />
      )}

      {uploadMessage && (
        <Alert
          severity={uploadMessage.type}
          sx={{ mt: 1 }}
          onClose={() => setUploadMessage(null)}
        >
          {uploadMessage.text}
        </Alert>
      )}
    </Paper>
  )
}