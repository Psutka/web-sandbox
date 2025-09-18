# Container Manager - WebContainer Alternative

A monorepo containing a ContainerManager service that creates and manages Docker containers with WebContainer-like API endpoints and WebSocket interactions.

## Architecture

- **Backend** (`apps/backend`): NestJS service that manages Docker containers
- **Frontend** (`apps/frontend`): Next.js AgentApp client with Material-UI and Tailwind CSS
- **Monorepo**: npm workspaces with shared configurations

## Features

- Create/delete Docker containers via REST API
- WebContainer-compatible API endpoints for easy client migration
- WebSocket support for real-time container interactions
- File system operations (read/write files, create directories)
- Process spawning and terminal emulation
- Modern UI with Material-UI components and dark theme

## Quick Start

### Prerequisites

- Node.js 18+
- Docker Desktop
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp apps/frontend/.env.local.example apps/frontend/.env.local

# Start development servers
npm run dev
```

This will start:
- Backend API server on `http://localhost:3001`
- Frontend application on `http://localhost:3000`

### API Endpoints

#### Container Management
- `POST /containers` - Create a new container
- `GET /containers` - List all containers
- `GET /containers/:id` - Get container info
- `DELETE /containers/:id` - Delete container

#### WebContainer-Compatible API
- `POST /webcontainer/boot` - Boot a WebContainer instance
- `POST /webcontainer/:id/fs/writeFile` - Write file
- `GET /webcontainer/:id/fs/readFile/:path` - Read file
- `GET /webcontainer/:id/fs/readdir/:path` - List directory
- `POST /webcontainer/:id/fs/mkdir` - Create directory
- `DELETE /webcontainer/:id/fs/rm` - Remove file/directory
- `POST /webcontainer/:id/spawn` - Spawn process

#### WebSocket Events
Connect to `/container` namespace:
- `join-container` - Join a container session
- `fs-operation` - File system operations
- `process-operation` - Process operations
- `terminal-input` - Terminal input

## Development

```bash
# Run all services in development mode
npm run dev

# Build all packages
npm run build

# Run linting
npm run lint

# Clean all build artifacts
npm run clean
```

## Project Structure

```
├── apps/
│   ├── backend/          # NestJS backend service
│   │   ├── src/
│   │   │   ├── container-manager/  # Docker container management
│   │   │   ├── websocket/          # WebSocket gateway
│   │   │   └── types/              # TypeScript types
│   │   └── package.json
│   └── frontend/         # Next.js frontend application
│       ├── src/
│       │   ├── app/                # Next.js app router
│       │   ├── components/         # React components
│       │   ├── lib/                # API clients and utilities
│       │   └── types/              # TypeScript types
│       └── package.json
├── packages/             # Shared packages (if needed)
└── package.json         # Root package.json
```

## Usage Examples

### Creating a Container

```typescript
import { webContainerAPI } from '@/lib/api'

// Boot a new container with files
const container = await webContainerAPI.boot({
  files: {
    'package.json': {
      file: {
        contents: JSON.stringify({ name: 'my-app', version: '1.0.0' })
      }
    }
  }
})

// Write a file
await webContainerAPI.writeFile(container.containerId, '/server.js', `
  const http = require('http')
  const server = http.createServer((req, res) => {
    res.end('Hello World!')
  })
  server.listen(3000)
`)

// Spawn a process
await webContainerAPI.spawn(container.containerId, 'node', ['server.js'])
```

### WebSocket Integration

```typescript
import { ContainerWebSocket } from '@/lib/websocket'

const ws = new ContainerWebSocket()
const socket = ws.connect(containerId)

// Listen for terminal output
ws.onMessage('terminal-output', (data) => {
  console.log(data.output)
})

// Send terminal input
ws.sendTerminalInput('ls -la')
```

## Technologies Used

- **Backend**: NestJS, TypeScript, Docker API, Socket.IO
- **Frontend**: Next.js 14, React 18, Material-UI, Tailwind CSS, Socket.IO Client
- **Build System**: npm workspaces, TypeScript, ESLint
- **Container Runtime**: Docker

## License

MIT