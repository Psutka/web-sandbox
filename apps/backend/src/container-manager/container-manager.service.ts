import { Injectable, Logger } from '@nestjs/common';
import * as Docker from 'dockerode';
import { v4 as uuidv4 } from 'uuid';
import { ContainerInfo, FileSystemTree } from '../types/webcontainer.types';

@Injectable()
export class ContainerManagerService {
  private readonly logger = new Logger(ContainerManagerService.name);
  private docker: Docker;
  private containers = new Map<string, ContainerInfo>();
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
        Image: 'node:18-alpine',
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

      if (files) {
        await this.writeFilesToContainer(container, files);
      }

      containerInfo.status = 'running';
      containerInfo.websocketUrl = `ws://localhost:${port}`;
      
      this.containers.set(containerId, containerInfo);
      this.logger.log(`Container ${containerId} created and started on port ${port}`);

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
      this.logger.log(`Container ${containerId} deleted`);
    } catch (error) {
      this.logger.error(`Failed to delete container ${containerId}:`, error);
      throw error;
    }
  }

  getContainer(containerId: string): ContainerInfo | undefined {
    return this.containers.get(containerId);
  }

  getAllContainers(): ContainerInfo[] {
    return Array.from(this.containers.values());
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
        output += chunk.toString();
      });
      stream.on('end', () => resolve(output));
      stream.on('error', reject);
    });
  }
}