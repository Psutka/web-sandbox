'use client'

import { useState } from 'react'
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
} from '@mui/material'
import { ContainerManager } from '@/components/ContainerManager'
import { Terminal } from '@/components/Terminal'
import { FileExplorer } from '@/components/FileExplorer'

export default function Home() {
  const [activeContainer, setActiveContainer] = useState<string | null>(null)

  return (
    <Container maxWidth="xl" className="py-8">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Agent App - Container Manager
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          WebContainer-like interface for Docker container management
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, height: '600px' }}>
            <Typography variant="h5" gutterBottom>
              Container Manager
            </Typography>
            <ContainerManager 
              onContainerSelect={setActiveContainer}
              activeContainer={activeContainer}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, height: '600px' }}>
            <Typography variant="h5" gutterBottom>
              File Explorer
            </Typography>
            <FileExplorer containerId={activeContainer} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, height: '600px' }}>
            <Typography variant="h5" gutterBottom>
              Terminal
            </Typography>
            <Terminal containerId={activeContainer} />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}