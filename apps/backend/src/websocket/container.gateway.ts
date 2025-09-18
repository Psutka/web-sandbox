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

  constructor(private containerService: ContainerManagerService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.containerConnections.delete(client.id);
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
      const result = await this.containerService.executeCommand(containerId, data.input);
      client.emit('terminal-output', { output: result.output || result.error || 'Command executed' });
    } catch (error) {
      this.logger.error(`Terminal command failed: ${error.message}`);
      client.emit('terminal-output', { output: `Error: ${error.message}` });
    }
  }

  private async executeFileSystemOperation(
    containerId: string,
    operation: FileSystemOperation,
  ): Promise<any> {
    // This is a simplified implementation
    // In a real scenario, you would execute these operations in the Docker container
    
    switch (operation.type) {
      case 'writeFile':
        return { success: true, message: `File ${operation.path} written` };
      
      case 'readFile':
        return { contents: `// Contents of ${operation.path}` };
      
      case 'readdir':
        return { files: ['file1.js', 'file2.ts', 'package.json'] };
      
      case 'mkdir':
        return { success: true, message: `Directory ${operation.path} created` };
      
      case 'rm':
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

      this.logger.log(`Executing process in container ${containerId}: ${command}`);
      const result = await this.containerService.executeCommand(containerId, command);

      return {
        pid: Math.floor(Math.random() * 10000),
        output: result.output || result.error || 'Command executed',
        exitCode: result.exitCode || 0,
      };
    }

    throw new Error(`Unknown process operation: ${operation.type}`);
  }
}