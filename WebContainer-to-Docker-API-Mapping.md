# WebContainer to Docker Container API Mapping

This document describes how WebContainer APIs are implemented using Docker containers in this project.

## Overview

This system provides WebContainer-compatible APIs backed by Docker containers instead of WebAssembly-based WebContainers. The implementation maintains API compatibility while leveraging Docker's container isolation and management capabilities.

## Core WebContainer APIs Implemented

### 1. Container Lifecycle Management

| WebContainer API | Docker Implementation | Location |
|------------------|----------------------|----------|
| `WebContainer.boot(options)` | Creates Docker container with `node:alpine` image | `webcontainer.controller.ts:25` |
| `webcontainer.teardown()` | Stops and removes Docker container | `container-manager.service.ts:82` |

**Implementation Details:**
- **Docker Setup**: Uses `node:alpine` base image with socat for port forwarding
- **Resource Limits**: 512MB memory, 512 CPU shares
- **Port Management**: Dynamic port assignment (base 8000) + port 3000 for web preview
- **Working Directory**: `/workspace` in container

### 2. File System Operations

| WebContainer API | Docker Implementation | Method |
|------------------|----------------------|---------|
| `fs.writeFile(path, contents)` | `docker exec` with echo command | `container-manager.service.ts:144-146` |
| `fs.readFile(path)` | `docker exec` with cat command | `webcontainer.controller.ts:62-77` |
| `fs.readdir(path)` | `docker exec` with ls command | `webcontainer.controller.ts:79-98` |
| `fs.mkdir(path)` | `docker exec` with mkdir command | `webcontainer.controller.ts:100-116` |
| `fs.rm(path)` | `docker exec` with rm command | `webcontainer.controller.ts:118-134` |

**Implementation Strategy:**
- **File Writing**: Uses shell echo with proper escaping: `echo 'contents' > /path/to/file`
- **Initial Files**: Written during container creation via `writeFilesToContainer()`
- **Runtime Operations**: Executed via Docker exec API with multiplexed stream handling

### 3. Process Management

| WebContainer API | Docker Implementation | Location |
|------------------|----------------------|----------|
| `spawn(command, args, options)` | `docker exec` with shell command | `webcontainer.controller.ts:136-154` |
| Process streams (stdin/stdout) | WebSocket-based terminal emulation | `container.gateway.ts:100-119` |

**Process Execution Flow:**
1. WebSocket connection established to container namespace
2. Terminal input sent via `terminal-input` WebSocket event
3. Commands executed using `containerService.executeCommand()`
4. Output streamed back via `terminal-output` WebSocket event

### 4. URL Access

| WebContainer API | Docker Implementation | Location |
|------------------|----------------------|----------|
| `url(port, options)` | Docker port binding with dynamic assignment | `webcontainer.controller.ts:156-168` |

**Port Management:**
- Container exposes port 3000 for web preview
- Dynamic port assignment for WebSocket connections
- URLs format: `http://localhost:3000` for preview, `ws://localhost:{port}` for WebSocket

## API Endpoints

### REST API Endpoints

```
POST /webcontainer/boot                           - Create new container
POST /webcontainer/:id/fs/writeFile              - Write file to container
GET  /webcontainer/:id/fs/readFile/:path         - Read file from container
GET  /webcontainer/:id/fs/readdir/:path          - List directory contents
POST /webcontainer/:id/fs/mkdir                  - Create directory
DELETE /webcontainer/:id/fs/rm                   - Remove file/directory
POST /webcontainer/:id/spawn                     - Execute command
GET  /webcontainer/:id/url                       - Get preview URL
POST /webcontainer/:id/mount                     - Mount files
GET  /webcontainer/:id/status                    - Get container status
```

### WebSocket Events

```
join-container      - Connect to specific container
fs-operation        - File system operations
process-operation   - Process spawning
terminal-input      - Terminal command execution
terminal-output     - Command output stream
```

## Docker Container Architecture

### Container Configuration
```javascript
{
  Image: 'node:alpine',
  Cmd: ['/bin/sh', '-c', 'apk add --no-cache socat && while true; do sleep 1000; done'],
  WorkingDir: '/workspace',
  ExposedPorts: {
    [`${port}/tcp`]: {},      // Dynamic WebSocket port
    '3000/tcp': {}            // Web preview port
  },
  HostConfig: {
    PortBindings: {
      [`${port}/tcp`]: [{ HostPort: port.toString() }],
      '3000/tcp': [{ HostPort: '0' }]
    },
    Memory: 512 * 1024 * 1024,  // 512MB limit
    CpuShares: 512
  }
}
```

### Command Execution Pipeline

1. **Client Request**: WebSocket or HTTP API call
2. **Container Lookup**: Find Docker container by UUID
3. **Docker Exec**: Create exec instance with proper command
4. **Stream Handling**: Parse multiplexed Docker streams (stdout/stderr)
5. **Response**: Return processed output to client

## Key Differences from WebContainers

| Aspect | WebContainer | Docker Implementation |
|--------|--------------|----------------------|
| **Runtime** | WebAssembly in browser | Docker containers on host |
| **Isolation** | Browser sandbox | Linux namespaces + cgroups |
| **File System** | In-memory WASM | Docker overlay filesystem |
| **Network** | Browser restrictions | Full Docker networking |
| **Process Model** | WASM processes | Linux processes in container |
| **Resource Limits** | Browser memory limits | Docker memory/CPU limits |

## Migration Guide

### From WebContainer to Docker Implementation

```typescript
// OLD: WebContainer API
import { WebContainer } from '@webcontainer/api'
const webcontainer = await WebContainer.boot()
await webcontainer.fs.writeFile('package.json', JSON.stringify(pkg))

// NEW: Docker-backed API
import { webContainerAPI } from '@/lib/api'
const container = await webContainerAPI.boot({ files })
await webContainerAPI.writeFile(container.containerId, 'package.json', JSON.stringify(pkg))
```

### Client-Side Integration

```typescript
// WebSocket connection for real-time operations
const ws = new ContainerWebSocket()
ws.connect(containerId)

// File system operations
ws.sendFileSystemOperation({
  type: 'writeFile',
  path: 'src/index.js',
  contents: 'console.log("Hello World")'
})

// Process execution
ws.sendProcessOperation({
  type: 'spawn',
  command: 'npm',
  args: ['run', 'dev']
})
```

## Technical Implementation Details

### Stream Multiplexing
Docker exec streams use 8-byte headers to multiplex stdout/stderr:
- Bytes 0-3: Stream type (0=stdin, 1=stdout, 2=stderr)
- Bytes 4-7: Payload size (big-endian uint32)
- Bytes 8+: Actual data

### File System Operations
Files are written using shell commands with proper escaping:
```bash
mkdir -p /workspace/src
echo 'file contents with proper '\''escaping'\''' > /workspace/src/file.js
```

### Container State Management
- **In-Memory Maps**: Container info stored in `Map<string, ContainerInfo>`
- **UUID Mapping**: WebContainer IDs mapped to Docker container IDs
- **Status Tracking**: Container lifecycle states (creating/running/stopped/error)

### Error Handling
- **Container Not Found**: HTTP 404 responses
- **Docker Errors**: Wrapped in HTTP 500 with error details
- **WebSocket Errors**: Emitted as `error` events to connected clients

This implementation provides a seamless migration path from WebContainers to Docker while maintaining API compatibility and adding enterprise-grade container management capabilities.