# Container Manager Service Interactions - Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend (Next.js)
    participant API as API Client
    participant CMC as ContainerManagerController
    participant WCC as WebContainerController
    participant CMS as ContainerManagerService
    participant CG as ContainerGateway
    participant WS as WebSocket Client
    participant D as Docker Engine
    participant C as Docker Container

    %% Container Creation Flow
    Note over U, C: Container Creation Flow
    U->>FE: Click "Create Container"
    FE->>API: POST /containers { files }
    API->>CMC: createContainer(createContainerDto)
    CMC->>CMS: createContainer(files)

    CMS->>D: docker.createContainer(config)
    D-->>CMS: container object
    CMS->>D: container.start()
    D-->>CMS: started container

    CMS->>CMS: Store in containers Map
    CMS->>CMS: Store in dockerContainers Map
    CMS->>CMS: Generate random port

    CMS->>D: writeFilesToContainer(container, files)
    loop For each file
        CMS->>C: exec(['sh', '-c', 'echo content > path'])
        C-->>CMS: command result
    end

    CMS-->>CMC: ContainerInfo with port
    CMC-->>API: HTTP 201 { containerId, port, status }
    API-->>FE: Container created
    FE-->>U: Show container in list

    %% WebSocket Connection Flow
    Note over U, C: WebSocket Connection Flow
    U->>FE: Select container for terminal
    FE->>WS: new ContainerWebSocket()
    WS->>CG: connect to /container namespace
    CG-->>WS: connection established

    WS->>CG: emit('join-container', { containerId })
    CG->>CG: Store in containerConnections Map
    CG->>CG: Initialize working directory '/workspace'
    CG->>CMS: getContainer(containerId)
    CMS-->>CG: container info
    CG-->>WS: emit('joined-container', { containerId, status })
    WS-->>FE: Connection ready
    FE-->>U: Terminal ready for input

    %% Terminal Command Execution
    Note over U, C: Terminal Command Execution
    U->>FE: Type "ls -la" in terminal
    FE->>WS: sendTerminalInput("ls -la")
    WS->>CG: emit('terminal-input', { input: "ls -la" })

    CG->>CG: Get currentDir from containerWorkingDirs
    CG->>CG: Build command: cd "/workspace" && ls -la
    CG->>CMS: executeCommand(containerId, fullCommand)

    CMS->>CMS: Get Docker container from dockerContainers Map
    CMS->>C: exec(['sh', '-c', 'cd "/workspace" && ls -la'])
    C-->>CMS: stdout with file listing
    CMS->>CMS: Parse Docker stream (8-byte headers)
    CMS-->>CG: { output: "file listing" }

    CG-->>WS: emit('terminal-output', { output })
    WS-->>FE: Display output
    FE-->>U: Show file listing

    %% Directory Change Command
    Note over U, C: Directory Change Command
    U->>FE: Type "cd test" in terminal
    FE->>WS: sendTerminalInput("cd test")
    WS->>CG: emit('terminal-input', { input: "cd test" })

    CG->>CG: Detect cd command
    CG->>CG: handleCdCommand(containerId, "test")
    CG->>CG: Build resolve command: cd "/workspace" && cd "test" && pwd
    CG->>CMS: executeCommand(containerId, resolveCommand)

    CMS->>C: exec(['sh', '-c', 'cd "/workspace" && cd "test" && pwd'])
    C-->>CMS: stdout: "/workspace/test"
    CMS-->>CG: { output: "/workspace/test" }

    CG->>CG: Update containerWorkingDirs Map
    CG-->>WS: emit('terminal-output', { output: "" })
    WS-->>FE: Silent success (no output)
    FE-->>U: Directory changed (no visible feedback)

    %% File System Operation
    Note over U, C: File System Operation via WebSocket
    U->>FE: Click "Create File" in FileExplorer
    FE->>WS: emit('fs-operation', { type: 'writeFile', path: 'newfile.txt', contents: 'Hello' })
    WS->>CG: fs-operation event

    CG->>CG: executeFileSystemOperation(containerId, operation)
    CG->>CMS: executeCommand(containerId, "echo 'Hello' > newfile.txt")
    CMS->>C: exec(['sh', '-c', "echo 'Hello' > newfile.txt"])
    C-->>CMS: command result
    CMS-->>CG: { output: "" }

    CG-->>WS: emit('fs-result', { operation: 'writeFile', result: { success: true } })
    WS-->>FE: File created successfully
    FE-->>U: Update file explorer

    %% WebContainer Compatible API
    Note over U, C: WebContainer Compatible API Usage
    FE->>API: webContainerAPI.boot({ files })
    API->>WCC: POST /webcontainer/boot
    WCC->>CMS: createContainer(files)
    Note over CMS, C: Same Docker creation flow as above
    CMS-->>WCC: ContainerInfo
    WCC-->>API: HTTP 201 { containerId, port, url }

    FE->>API: webContainerAPI.writeFile(containerId, 'file.js', content)
    API->>WCC: POST /webcontainer/:id/fs/writeFile
    WCC->>CMS: executeCommand(containerId, echo command)
    CMS->>C: exec with file write command
    C-->>CMS: result
    CMS-->>WCC: success
    WCC-->>API: HTTP 200 { success: true }

    %% Container Cleanup
    Note over U, C: Container Cleanup
    U->>FE: Click "Delete Container"
    FE->>API: DELETE /containers/containerId
    API->>CMC: deleteContainer(containerId)
    CMC->>CMS: deleteContainer(containerId)

    CMS->>D: container.stop()
    D-->>CMS: stopped
    CMS->>D: container.remove()
    D-->>CMS: removed

    CMS->>CMS: Delete from containers Map
    CMS->>CMS: Delete from dockerContainers Map
    CG->>CG: Delete from containerWorkingDirs Map
    CG->>CG: Clean up WebSocket connections

    CMS-->>CMC: deletion confirmed
    CMC-->>API: HTTP 200
    API-->>FE: Container deleted
    FE-->>U: Remove from container list
```

## Key Interaction Patterns

### 1. **State Management Across Services**
- **ContainerManagerService**: Manages `containers` and `dockerContainers` Maps
- **ContainerGateway**: Manages `containerConnections` and `containerWorkingDirs` Maps
- **Coordinated Cleanup**: Both services clean their respective state on container deletion

### 2. **Docker Command Execution**
- **All operations** go through `ContainerManagerService.executeCommand()`
- **Real Docker exec**: Every command executes in actual Docker containers
- **Stream Parsing**: 8-byte headers properly parsed for stdout/stderr

### 3. **Working Directory Persistence**
- **cd commands** specially handled by `ContainerGateway.handleCdCommand()`
- **State persistence** across WebSocket connections
- **Command prefixing** with current directory for all subsequent commands

### 4. **Dual API Support**
- **Direct API**: Full container control via ContainerManagerController
- **WebContainer API**: Migration-compatible endpoints via WebContainerController
- **Shared Backend**: Both use same ContainerManagerService for Docker operations

### 5. **Error Handling Flow**
- **Docker errors** bubble up through service layer
- **HTTP status codes** properly set (404 for not found, 500 for Docker errors)
- **WebSocket errors** emitted as events to connected clients