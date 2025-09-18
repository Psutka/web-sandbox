# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Container Manager system that provides WebContainer-compatible APIs for Docker container management. The system creates ephemeral Docker containers that can be controlled via REST APIs and WebSocket connections, allowing seamless migration from WebContainers to Docker-based containers.

## Architecture

**Monorepo Structure**: Uses pnpm workspaces with two main applications:

- **Backend (`apps/backend`)**: NestJS service managing Docker containers via Dockerode
- **Frontend (`apps/frontend`)**: Next.js AgentApp client with Material-UI dark theme

**Core Services**:
- `ContainerManagerService`: Handles Docker container lifecycle (create/delete/manage)  
- `ContainerGateway`: WebSocket gateway for real-time container interactions
- `WebContainerController`: Provides WebContainer-compatible REST API endpoints

**Key Design Patterns**:
- Dual API approach: Direct container management + WebContainer-compatible endpoints
- WebSocket-first container interactions after initial setup
- State management via in-memory Maps for active containers
- Modular NestJS architecture with separate modules for containers and WebSockets

## Development Commands

```bash
# Install all dependencies
pnpm install

# Start both backend (port 3001) and frontend (port 3000) in development
pnpm dev

# Build all packages
pnpm build

# Run linting across all workspaces
pnpm lint

# Clean build artifacts
pnpm clean

# Work with specific workspace
pnpm --filter apps/backend <command>
pnpm --filter apps/frontend <command>
```

## API Architecture

**Container Management Flow**:
1. `POST /containers` or `POST /webcontainer/boot` creates Docker container
2. Container gets assigned port and WebSocket URL  
3. Client connects to WebSocket at `/container` namespace
4. All further interactions (file ops, process spawning) via WebSocket
5. `DELETE /containers/:id` terminates container and cleans up resources

**WebContainer API Compatibility**:
- `/webcontainer/boot` → Container creation with initial files
- `/webcontainer/:id/fs/*` → File system operations (read/write/mkdir/rm)  
- `/webcontainer/:id/spawn` → Process spawning
- `/webcontainer/:id/url` → Get container preview URL

**WebSocket Events**:
- `join-container` - Establish connection to specific container
- `fs-operation` - File system commands  
- `process-operation` - Process spawning
- `terminal-input` - Terminal interaction

## Frontend Architecture

**Component Structure**:
- `ContainerManager`: Create/delete/select containers
- `FileExplorer`: Navigate container filesystem with create/delete operations
- `Terminal`: WebSocket-based terminal emulation with command execution

**State Management**:
- React useState for active container selection
- WebSocket connections managed per container via `ContainerWebSocket` class
- API calls via centralized `webContainerAPI` and `containerAPI` clients

**Key Libraries**:
- Material-UI v5 with custom dark theme
- Tailwind CSS for additional styling
- Socket.IO client for WebSocket connections
- Axios for HTTP API calls

## Docker Integration

**Container Configuration**:
- Base image: `node:alpine`
- Working directory: `/workspace`
- Exposed ports: Dynamic assignment + 3000 for web preview
- Resource limits: 512MB memory, 512 CPU shares
- Initial setup includes socat for port forwarding

**File System Operations**:
- Initial files written during container creation via `writeFilesToContainer`
- Runtime file operations executed via `execInContainer` method
- File contents passed as shell commands with proper escaping

## Environment Setup

**Prerequisites**:
- Node.js 18+
- Docker Desktop running
- pnpm package manager

**Environment Variables**:
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:3001)
- `NEXT_PUBLIC_WS_URL`: WebSocket URL (default: ws://localhost:3001)

Copy `apps/frontend/.env.local.example` to `apps/frontend/.env.local` for local development.

## WebContainer Migration Guide

To migrate from WebContainers to this system:

1. Replace WebContainer import:
   ```typescript
   // Old: import { WebContainer } from '@webcontainer/api'
   import { webContainerAPI } from '@/lib/api'
   ```

2. Update boot call:
   ```typescript
   // Old: const webcontainerInstance = await WebContainer.boot()
   const container = await webContainerAPI.boot({ files })
   ```

3. Update API calls by prefixing container ID:
   ```typescript
   // Old: webcontainerInstance.fs.writeFile(path, contents)
   await webContainerAPI.writeFile(container.containerId, path, contents)
   ```

4. WebSocket integration for real-time operations:
   ```typescript
   const ws = new ContainerWebSocket()
   ws.connect(container.containerId)
   ```