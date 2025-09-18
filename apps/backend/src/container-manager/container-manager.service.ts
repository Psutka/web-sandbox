import { Injectable, Logger } from '@nestjs/common';
import * as Docker from 'dockerode';
import { v4 as uuidv4 } from 'uuid';
import { ContainerInfo, FileSystemTree } from '../types/webcontainer.types';

@Injectable()
export class ContainerManagerService {
  private readonly logger = new Logger(ContainerManagerService.name);
  private docker: Docker;
  private containers = new Map<string, ContainerInfo>();
  private dockerContainers = new Map<string, string>(); // containerId -> dockerContainerId
  private readonly BASE_PORT = 8000;

  constructor() {
    this.docker = new Docker();
  }

  async createContainer(files?: FileSystemTree): Promise<ContainerInfo> {
    const containerId = uuidv4();
    const port = this.BASE_PORT + Math.floor(Math.random() * 1000);

    try {
      const containerInfo: ContainerInfo = {
        id: containerId,
        status: 'creating',
        port,
        createdAt: new Date(),
      };

      this.containers.set(containerId, containerInfo);

      const container = await this.docker.createContainer({
        Image: 'node:alpine',
        Cmd: ['/bin/sh', '-c', 'apk add --no-cache socat && while true; do sleep 1000; done'],
        WorkingDir: '/workspace',
        ExposedPorts: {
          [`${port}/tcp`]: {},
          '3000/tcp': {},
        },
        HostConfig: {
          PortBindings: {
            [`${port}/tcp`]: [{ HostPort: port.toString() }],
            '3000/tcp': [{ HostPort: '0' }],
          },
          Memory: 512 * 1024 * 1024, // 512MB
          CpuShares: 512,
        },
        Env: [
          'NODE_ENV=development',
          `WEBSOCKET_PORT=${port}`,
        ],
      });

      await container.start();

      // Store the Docker container ID mapping
      this.dockerContainers.set(containerId, container.id);

      if (files) {
        await this.writeFilesToContainer(container, files);
      }

      containerInfo.status = 'running';
      containerInfo.websocketUrl = `ws://localhost:${port}`;

      // Get the actual mapped port for port 3000 (preview port)
      const previewPort = await this.getContainerPreviewPort(containerId);
      if (previewPort) {
        containerInfo.previewPort = previewPort;
        containerInfo.previewUrl = `http://localhost:${previewPort}`;
      }

      this.containers.set(containerId, containerInfo);
      this.logger.log(`Container ${containerId} created and started on port ${port}${previewPort ? `, preview on port ${previewPort}` : ''}`);

      return containerInfo;
    } catch (error) {
      this.logger.error(`Failed to create container ${containerId}:`, error);
      const containerInfo: ContainerInfo = {
        id: containerId,
        status: 'error',
        createdAt: new Date(),
      };
      this.containers.set(containerId, containerInfo);
      throw error;
    }
  }

  async deleteContainer(containerId: string): Promise<void> {
    try {
      const containerInfo = this.containers.get(containerId);
      if (!containerInfo) {
        throw new Error(`Container ${containerId} not found`);
      }

      const containers = await this.docker.listContainers({ all: true });
      const dockerContainer = containers.find(c => 
        c.Names.some(name => name.includes(containerId.substring(0, 12)))
      );

      if (dockerContainer) {
        const container = this.docker.getContainer(dockerContainer.Id);
        await container.stop();
        await container.remove();
      }

      containerInfo.status = 'stopped';
      this.containers.delete(containerId);
      this.dockerContainers.delete(containerId);
      this.logger.log(`Container ${containerId} deleted`);
    } catch (error) {
      this.logger.error(`Failed to delete container ${containerId}:`, error);
      throw error;
    }
  }

  getContainer(containerId: string): ContainerInfo | undefined {
    return this.containers.get(containerId);
  }

  async getContainerPreviewPort(containerId: string): Promise<number | null> {
    try {
      const dockerContainerId = this.dockerContainers.get(containerId);
      if (!dockerContainerId) {
        return null;
      }

      const container = this.docker.getContainer(dockerContainerId);
      const containerInfo = await container.inspect();

      // Look for port 3000 mapping
      const portBindings = containerInfo.NetworkSettings?.Ports;
      const port3000Binding = portBindings?.['3000/tcp'];

      if (port3000Binding && port3000Binding.length > 0) {
        const hostPort = port3000Binding[0].HostPort;
        return hostPort ? parseInt(hostPort, 10) : null;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get preview port for container ${containerId}:`, error);
      return null;
    }
  }

  getAllContainers(): ContainerInfo[] {
    return Array.from(this.containers.values());
  }

  async executeCommand(containerId: string, command: string): Promise<{ output: string; error?: string; exitCode?: number }> {
    try {
      const containerInfo = this.containers.get(containerId);
      if (!containerInfo) {
        throw new Error(`Container ${containerId} not found`);
      }

      const dockerContainerId = this.dockerContainers.get(containerId);
      if (!dockerContainerId) {
        throw new Error(`Docker container ID for ${containerId} not found`);
      }

      const container = this.docker.getContainer(dockerContainerId);
      const output = await this.execInContainer(container, ['sh', '-c', command]);

      return { output: output.replace(/^\s+|\s+$/g, '').replace(/^[\x00-\x08\x0E-\x1F\x7F]*/g, '') };
    } catch (error) {
      this.logger.error(`Failed to execute command in container ${containerId}:`, error);
      return { output: '', error: error.message };
    }
  }

  private async writeFilesToContainer(container: Docker.Container, files: FileSystemTree, basePath = '/workspace'): Promise<void> {
    for (const [name, node] of Object.entries(files)) {
      const fullPath = `${basePath}/${name}`;
      
      if (node.file) {
        await this.execInContainer(container, ['mkdir', '-p', basePath]);
        await this.execInContainer(container, ['sh', '-c', `echo '${node.file.contents.replace(/'/g, "'\\''")}' > ${fullPath}`]);
      } else if (node.directory) {
        await this.execInContainer(container, ['mkdir', '-p', fullPath]);
        await this.writeFilesToContainer(container, node.directory, fullPath);
      }
    }
  }

  async uploadFileViaWebSocket(
    containerId: string,
    filename: string,
    targetPath: string,
    content: string,
    encoding: 'utf8' | 'base64' = 'utf8'
  ): Promise<{ success: boolean; path: string }> {
    const container = this.getContainer(containerId);
    if (!container) {
      throw new Error('Container not found');
    }

    try {
      // Ensure target directory exists
      const directory = targetPath.substring(0, targetPath.lastIndexOf('/'));
      if (directory) {
        await this.executeCommand(containerId, `mkdir -p ${directory}`);
      }

      let writeCommand: string;

      if (encoding === 'base64') {
        // For binary files, decode base64 and write to file
        writeCommand = `echo '${content}' | base64 -d > ${targetPath}`;
      } else {
        // For text files, escape single quotes and write
        const escapedContent = content.replace(/'/g, "'\\''" );
        writeCommand = `echo '${escapedContent}' > ${targetPath}`;
      }

      const result = await this.executeCommand(containerId, writeCommand);

      if (result.error) {
        throw new Error(`File upload failed: ${result.error}`);
      }

      this.logger.log(`File uploaded successfully: ${filename} -> ${targetPath}`);

      return {
        success: true,
        path: targetPath
      };
    } catch (error) {
      this.logger.error(`Failed to upload file ${filename}:`, error);
      throw error;
    }
  }

  private async execInContainer(container: Docker.Container, cmd: string[]): Promise<string> {
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ Detach: false });

    return new Promise((resolve, reject) => {
      let output = '';
      stream.on('data', (chunk) => {
        // Docker exec streams are multiplexed - handle properly
        let offset = 0;
        while (offset < chunk.length) {
          if (chunk.length - offset < 8) {
            // Not enough data for header, treat as raw data
            output += chunk.slice(offset).toString();
            break;
          }

          // Read the 8-byte header
          const header = chunk.slice(offset, offset + 8);
          const streamType = header[0]; // 0=stdin, 1=stdout, 2=stderr
          const size = header.readUInt32BE(4);

          if (size === 0 || offset + 8 + size > chunk.length) {
            // Invalid size or not enough data, treat remaining as raw
            output += chunk.slice(offset).toString();
            break;
          }

          // Extract the actual data
          const data = chunk.slice(offset + 8, offset + 8 + size);
          if (streamType === 1 || streamType === 2) { // stdout or stderr
            output += data.toString();
          }

          offset += 8 + size;
        }
      });
      stream.on('end', () => resolve(output));
      stream.on('error', reject);
    });
  }
}