# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Container Manager system that provides WebContainer-compatible APIs for Docker container management. The system creates ephemeral Docker containers that can be controlled via REST APIs and WebSocket connections, allowing seamless migration from WebContainers to Docker-based containers.

## Architecture

**Monorepo Structure**: Uses pnpm workspaces with two main applications:

- **Backend (`apps/backend`)**: NestJS service managing Docker containers via Dockerode
- **Frontend (`apps/frontend`)**: Next.js client with Material-UI dark theme and Tailwind CSS

**Core Services**:
- `ContainerManagerService`: Handles Docker container lifecycle and file operations via Docker API
- `ContainerGateway`: WebSocket gateway for real-time container interactions with persistent directory state
- `WebContainerController`: Provides WebContainer-compatible REST API endpoints
- `ContainerManagerController`: Direct container management API

**Key Design Patterns**:
- Dual API approach: Direct container management + WebContainer-compatible endpoints
- WebSocket-first container interactions after initial REST setup
- In-memory state management with three Maps: containers, dockerContainers, containerWorkingDirs
- Modular NestJS architecture with separate modules for containers and WebSockets
- Real Docker command execution for all file system operations

## Development Commands

**Note**: Root package.json uses npm scripts with concurrently, but pnpm is recommended for workspace management.

```bash
# Install all dependencies
pnpm install

# Start both backend (port 3001) and frontend (port 3000) in development
npm run dev
# OR (equivalent)
concurrently "cd apps/backend && npm run dev" "cd apps/frontend && npm run dev"

# Build all packages
npm run build

# Run linting across all workspaces
npm run lint

# Clean build artifacts
npm run clean

# Install dependencies for all workspaces
npm run install:all
```

**Backend-specific commands**:
```bash
cd apps/backend

# Development server with watch mode
npm run start:dev

# Production build
npm run build

# Start production server
npm run start:prod

# Debug mode
npm run start:debug

# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run end-to-end tests
npm run test:e2e

# Debug tests
npm run test:debug

# Lint and format
npm run lint
npm run format
```

**Frontend-specific commands**:
```bash
cd apps/frontend

# Development server
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Linting
npm run lint
```

## API Architecture

**Container Management Flow**:
1. `POST /containers` or `POST /webcontainer/boot` creates Docker container with node:alpine image
2. Container gets assigned random port (BASE_PORT 8000 + offset) and WebSocket URL
3. Client connects to WebSocket at `/container` namespace with `join-container` event
4. All further interactions (file ops, process spawning, terminal) via WebSocket
5. `DELETE /containers/:id` stops and removes Docker container, cleans up state

**REST API Endpoints**:
- **Container Management**: `GET|POST /containers`, `GET|DELETE /containers/:id`
- **WebContainer Compatibility**: `POST /webcontainer/boot`, `POST /webcontainer/:id/fs/writeFile`, `GET /webcontainer/:id/fs/readFile/:path`, `GET /webcontainer/:id/fs/readdir/:path`, `POST /webcontainer/:id/fs/mkdir`, `DELETE /webcontainer/:id/fs/rm`, `POST /webcontainer/:id/spawn`, `GET /webcontainer/:id/url`
- **API Documentation**: Swagger UI available at `/api`

**WebSocket Events** (namespace: `/container`):
- `join-container` - Establish connection to specific container
- `fs-operation` - File system commands (executed as real Docker commands)
- `process-operation` - Process spawning
- `terminal-input` - Terminal interaction with persistent working directory state

## Frontend Architecture

**Component Structure**:
- `ContainerManager`: Create/delete/select containers with status display
- `FileExplorer`: Navigate container filesystem with create/delete operations
- `Terminal`: WebSocket-based terminal emulation with command execution
- `FileUploadPanel`: File upload interface
- `ThemeProvider`: Material-UI dark theme configuration

**State Management**:
- React useState for active container selection and UI state
- WebSocket connections managed per container via `ContainerWebSocket` class
- API calls via centralized `webContainerAPI` and `containerAPI` clients

**Key Technologies**:
- Next.js 14 with App Router
- Material-UI v5 with custom dark theme (`@mui/material`, `@mui/icons-material`)
- Tailwind CSS for additional styling
- Socket.IO client for WebSocket connections
- Axios for HTTP API calls
- TypeScript for type safety

## Docker Integration

**Container Configuration**:
- Base image: `node:alpine`
- Working directory: `/workspace`
- Exposed ports: Dynamic assignment (BASE_PORT + random offset) + 3000 for web preview
- Resource limits: 512MB memory, 512 CPU shares
- Initial command: Install socat and run infinite sleep loop
- Environment variables: `NODE_ENV=development`, `WEBSOCKET_PORT=${port}`

**File System Operations**:
- Initial files written during container creation via `writeFilesToContainer` method
- All runtime file operations executed as real Docker commands via `execInContainer`
- File contents properly escaped for shell execution: `contents.replace(/'/g, "'\\''")`
- Docker exec streams use 8-byte headers for stdout/stderr multiplexing (bytes 0-3: stream type, bytes 4-7: payload size)
- Directory listing uses `ls -la` with custom parsing for file types and permissions
- **CRITICAL**: All file system APIs execute actual Docker commands, not mock data

**Container State Management**:
- `containers` Map: UUID → ContainerInfo (application state)
- `dockerContainers` Map: UUID → Docker container ID (Docker API mapping)
- `containerWorkingDirs` Map: UUID → current working directory (terminal sessions)
- Port assignment: BASE_PORT (8000) + Math.floor(Math.random() * 1000)

## Environment Setup

**Prerequisites**:
- Node.js 18+
- Docker Desktop running and accessible
- pnpm package manager (recommended)

**Environment Variables**:
Frontend configuration (copy `apps/frontend/.env.local.example` to `apps/frontend/.env.local`):
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:3001)
- `NEXT_PUBLIC_WS_URL`: WebSocket URL (default: ws://localhost:3001)

**CORS Configuration**: Backend enables CORS with `origin: true, credentials: true` for development.

## WebContainer Migration Guide

For migrating from WebContainers to this Docker-based system:

**1. API Client Replacement**:
```typescript
// Old: import { WebContainer } from '@webcontainer/api'
import { webContainerAPI } from '@/lib/api'
```

**2. Container Boot Process**:
```typescript
// Old: const webcontainerInstance = await WebContainer.boot()
const container = await webContainerAPI.boot({ files })
console.log(container.containerId) // Use this ID for subsequent calls
```

**3. File System Operations**:
```typescript
// Old: webcontainerInstance.fs.writeFile(path, contents)
await webContainerAPI.writeFile(container.containerId, path, contents)

// Old: webcontainerInstance.fs.readFile(path)
const content = await webContainerAPI.readFile(container.containerId, path)

// Old: webcontainerInstance.fs.readdir(path)
const files = await webContainerAPI.readdir(container.containerId, path)
```

**4. Process Spawning**:
```typescript
// Old: webcontainerInstance.spawn('npm', ['install'])
await webContainerAPI.spawn(container.containerId, 'npm', ['install'])
```

**5. WebSocket Integration**:
```typescript
import { ContainerWebSocket } from '@/lib/websocket'

const ws = new ContainerWebSocket()
ws.connect(container.containerId)

// Listen for terminal output
ws.onMessage('terminal-output', (data) => console.log(data.output))

// Send commands
ws.sendTerminalInput('npm run dev')
```

## Critical Implementation Details

**Docker Stream Multiplexing**:
Docker exec streams use 8-byte headers that must be parsed correctly:
- Bytes 0-3: Stream type (0=stdin, 1=stdout, 2=stderr)
- Bytes 4-7: Payload size (big-endian uint32)
- Implementation in `ContainerManagerService.execInContainer()` method

**Terminal Session Management**:
The WebSocket gateway maintains persistent working directory state:
- `cd` commands intercepted and handled specially via `handleCdCommand()`
- All commands execute from current working directory: `cd ${currentDir} && ${command}`
- Supports absolute paths (`/`), relative paths (`../dir`), and home directory (`~`)
- State persists across WebSocket reconnections until container deletion
- Implementation in `ContainerGateway` at `/container` namespace

**File System Operations**:
- All operations execute real Docker commands via `dockerode`
- File contents properly escaped for shell execution
- Directory listings parsed from `ls -la` output with custom parsing logic
- **IMPORTANT**: No mock data - all operations affect actual container filesystem

**Error Handling Patterns**:
- Container not found: HTTP 404 responses
- Docker API errors: HTTP 500 with error details in response body
- WebSocket errors: Emitted as `error` events to connected clients
- Failed container creation: Status set to 'error' in containers Map

**Security & Resource Management**:
- Container isolation via Docker namespaces and cgroups
- Resource limits: 512MB memory, 512 CPU shares per container
- Shell command escaping: `contents.replace(/'/g, "'\\''")`
- CORS enabled for development with credentials support

## Project Structure

```
apps/
├── backend/                    # NestJS Backend Service
│   ├── src/
│   │   ├── main.ts            # App bootstrap with CORS and Swagger
│   │   ├── app.module.ts      # Root module importing container and websocket modules
│   │   ├── container-manager/ # Docker container management
│   │   │   ├── container-manager.service.ts    # Core Docker operations
│   │   │   ├── container-manager.controller.ts # Direct container API
│   │   │   ├── webcontainer.controller.ts      # WebContainer-compatible API
│   │   │   └── container-manager.module.ts     # Module configuration
│   │   ├── websocket/         # Real-time communication
│   │   │   ├── container.gateway.ts            # WebSocket event handling
│   │   │   └── websocket.module.ts             # WebSocket module
│   │   └── types/             # TypeScript type definitions
│   │       └── webcontainer.types.ts
│   ├── nest-cli.json         # NestJS CLI configuration
│   └── package.json          # Backend dependencies and scripts
└── frontend/                  # Next.js Frontend Client
    ├── src/
    │   ├── app/               # Next.js App Router
    │   │   ├── layout.tsx     # Root layout with theme provider
    │   │   └── page.tsx       # Main application page
    │   ├── components/        # React Components
    │   │   ├── ContainerManager.tsx    # Container CRUD operations
    │   │   ├── FileExplorer.tsx        # File system navigation
    │   │   ├── Terminal.tsx            # Terminal emulation
    │   │   ├── FileUploadPanel.tsx     # File upload interface
    │   │   └── ThemeProvider.tsx       # Material-UI theme setup
    │   ├── lib/               # API clients and utilities
    │   │   └── api.ts         # HTTP API clients (containerAPI, webContainerAPI)
    │   └── types/             # Frontend TypeScript types
    │       └── container.types.ts
    ├── .env.local.example     # Environment variable template
    ├── next.config.js         # Next.js configuration
    ├── tailwind.config.js     # Tailwind CSS configuration
    └── package.json           # Frontend dependencies and scripts
```