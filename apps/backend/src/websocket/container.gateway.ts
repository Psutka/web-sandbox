import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ContainerManagerService } from '../container-manager/container-manager.service';
import {
  FileSystemOperation,
  ProcessOperation,
  SpawnOptions,
} from '../types/webcontainer.types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/container',
})
export class ContainerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ContainerGateway.name);
  private containerConnections = new Map<string, string>(); // socketId -> containerId
  private containerWorkingDirs = new Map<string, string>(); // containerId -> current working directory

  constructor(private containerService: ContainerManagerService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const containerId = this.containerConnections.get(client.id);
    this.containerConnections.delete(client.id);

    // Clean up working directory if no other clients are connected to this container
    if (containerId) {
      const hasOtherConnections = Array.from(this.containerConnections.values()).includes(containerId);
      if (!hasOtherConnections) {
        this.containerWorkingDirs.delete(containerId);
      }
    }
  }

  @SubscribeMessage('join-container')
  handleJoinContainer(
    @MessageBody() data: { containerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { containerId } = data;
    const container = this.containerService.getContainer(containerId);
    
    if (!container) {
      client.emit('error', { message: 'Container not found' });
      return;
    }

    this.containerConnections.set(client.id, containerId);
    client.join(`container-${containerId}`);

    // Initialize working directory for this container if not set
    if (!this.containerWorkingDirs.has(containerId)) {
      this.containerWorkingDirs.set(containerId, '/workspace');
    }

    client.emit('joined-container', { containerId, status: container.status });
    this.logger.log(`Client ${client.id} joined container ${containerId}`);
  }

  @SubscribeMessage('fs-operation')
  async handleFileSystemOperation(
    @MessageBody() operation: FileSystemOperation,
    @ConnectedSocket() client: Socket,
  ) {
    const containerId = this.containerConnections.get(client.id);
    if (!containerId) {
      client.emit('error', { message: 'Not connected to a container' });
      return;
    }

    try {
      const result = await this.executeFileSystemOperation(containerId, operation);
      client.emit('fs-result', { operation: operation.type, result });
    } catch (error) {
      client.emit('error', { message: error.message, operation: operation.type });
    }
  }

  @SubscribeMessage('process-operation')
  async handleProcessOperation(
    @MessageBody() operation: ProcessOperation,
    @ConnectedSocket() client: Socket,
  ) {
    const containerId = this.containerConnections.get(client.id);
    if (!containerId) {
      client.emit('error', { message: 'Not connected to a container' });
      return;
    }

    try {
      const result = await this.executeProcessOperation(containerId, operation);
      client.emit('process-result', { operation: 'spawn', result });
    } catch (error) {
      client.emit('error', { message: error.message, operation: 'spawn' });
    }
  }

  @SubscribeMessage('terminal-input')
  async handleTerminalInput(
    @MessageBody() data: { input: string },
    @ConnectedSocket() client: Socket,
  ) {
    const containerId = this.containerConnections.get(client.id);
    if (!containerId) {
      client.emit('error', { message: 'Not connected to a container' });
      return;
    }

    try {
      this.logger.log(`Executing terminal command in container ${containerId}: ${data.input}`);
      this.logger.log(`Container working dirs state: ${JSON.stringify(Array.from(this.containerWorkingDirs.entries()))}`);

      const currentDir = this.containerWorkingDirs.get(containerId) || '/workspace';
      this.logger.log(`Current working directory for container ${containerId}: "${currentDir}"`);
      const trimmedInput = data.input.trim();

      // Handle cd command specially to maintain directory state
      if (trimmedInput.startsWith('cd ') || trimmedInput === 'cd') {
        const targetDir = trimmedInput === 'cd' ? '' : trimmedInput.substring(3).trim();
        await this.handleCdCommand(containerId, targetDir, client);
        return;
      }

      // Handle pwd command to show current directory
      if (trimmedInput === 'pwd') {
        this.logger.log(`PWD command: stored working directory is "${currentDir}"`);
        client.emit('terminal-output', { output: currentDir });
        return;
      }

      // Execute command in the current working directory
      const fullCommand = `cd "${currentDir}" && ${data.input}`;
      this.logger.log(`Executing command with working directory: cd "${currentDir}" && ${data.input}`);
      const result = await this.containerService.executeCommand(containerId, fullCommand);
      client.emit('terminal-output', { output: result.output || result.error || 'Command executed' });
    } catch (error) {
      this.logger.error(`Terminal command failed: ${error.message}`);
      client.emit('terminal-output', { output: `Error: ${error.message}` });
    }
  }

  private async handleCdCommand(
    containerId: string,
    targetDir: string,
    client: Socket,
  ) {
    const currentDir = this.containerWorkingDirs.get(containerId) || '/workspace';

    this.logger.log(`CD command: targetDir="${targetDir}", currentDir="${currentDir}"`);

    // Handle special cases and resolve the path properly using the shell
    let resolveCommand: string;
    if (targetDir === '' || targetDir === '~') {
      resolveCommand = 'cd /workspace && pwd';
    } else if (targetDir.startsWith('/')) {
      resolveCommand = `cd "${targetDir}" && pwd`;
    } else {
      // For relative paths, let the shell resolve them from current directory
      resolveCommand = `cd "${currentDir}" && cd "${targetDir}" && pwd`;
    }

    this.logger.log(`CD command: resolve command="${resolveCommand}"`);

    // Try to change to the directory and get the canonical path
    const result = await this.containerService.executeCommand(containerId, resolveCommand);

    this.logger.log(`CD command: result output="${result.output}", error="${result.error}"`);

    // Check if the output contains error messages or if there's an explicit error
    const output = result.output?.trim() || '';
    const hasError = result.error ||
                    output.includes("can't cd to") ||
                    output.includes("No such file or directory") ||
                    output.includes("Permission denied") ||
                    !output.startsWith('/');

    if (hasError) {
      client.emit('terminal-output', { output: `cd: ${targetDir}: No such file or directory` });
      return;
    }

    // Update the stored working directory with the actual resolved path
    this.containerWorkingDirs.set(containerId, output);

    this.logger.log(`CD command: updated working directory to "${output}"`);
    this.logger.log(`CD command: containerWorkingDirs after update: ${JSON.stringify(Array.from(this.containerWorkingDirs.entries()))}`);

    // Don't emit any output for successful cd command (like real terminal)
    client.emit('terminal-output', { output: '' });
  }

  private async executeFileSystemOperation(
    containerId: string,
    operation: FileSystemOperation,
  ): Promise<any> {
    switch (operation.type) {
      case 'writeFile':
        if (!operation.contents) {
          throw new Error('File contents required for writeFile operation');
        }
        const writeResult = await this.containerService.executeCommand(
          containerId,
          `echo '${operation.contents.replace(/'/g, "'\\''")}' > ${operation.path}`
        );
        if (writeResult.error) {
          throw new Error(writeResult.error);
        }
        return { success: true, message: `File ${operation.path} written` };

      case 'readFile':
        const readResult = await this.containerService.executeCommand(
          containerId,
          `cat ${operation.path}`
        );
        if (readResult.error) {
          throw new Error(readResult.error);
        }
        return { contents: readResult.output };

      case 'readdir':
        const dirResult = await this.containerService.executeCommand(
          containerId,
          `ls -la ${operation.path} | tail -n +2 | awk '{print $9, $1}' | grep -v "^\\.$" | grep -v "^\\.\\.\\s"`
        );
        if (dirResult.error) {
          throw new Error(dirResult.error);
        }

        const files = dirResult.output
          .split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [name, permissions] = line.split(' ');
            return {
              name,
              type: permissions.startsWith('d') ? 'directory' : 'file'
            };
          });

        return { files };

      case 'mkdir':
        const mkdirResult = await this.containerService.executeCommand(
          containerId,
          `mkdir -p ${operation.path}`
        );
        if (mkdirResult.error) {
          throw new Error(mkdirResult.error);
        }
        return { success: true, message: `Directory ${operation.path} created` };

      case 'rm':
        const rmResult = await this.containerService.executeCommand(
          containerId,
          `rm -rf ${operation.path}`
        );
        if (rmResult.error) {
          throw new Error(rmResult.error);
        }
        return { success: true, message: `${operation.path} removed` };

      default:
        throw new Error(`Unknown file system operation: ${operation.type}`);
    }
  }

  private async executeProcessOperation(
    containerId: string,
    operation: ProcessOperation,
  ): Promise<any> {
    if (operation.type === 'spawn') {
      const command = operation.args
        ? `${operation.command} ${operation.args.join(' ')}`
        : operation.command;

      // Use the stored working directory for process operations too
      const currentDir = this.containerWorkingDirs.get(containerId) || '/workspace';
      const fullCommand = `cd "${currentDir}" && ${command}`;

      this.logger.log(`Executing process in container ${containerId}: ${command}`);
      this.logger.log(`Process operation using working directory: cd "${currentDir}" && ${command}`);
      const result = await this.containerService.executeCommand(containerId, fullCommand);

      return {
        pid: Math.floor(Math.random() * 10000),
        output: result.output || result.error || 'Command executed',
        exitCode: result.exitCode || 0,
      };
    }

    throw new Error(`Unknown process operation: ${operation.type}`);
  }
}