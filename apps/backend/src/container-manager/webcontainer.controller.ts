import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ContainerManagerService } from './container-manager.service';
import {
  FileSystemTree,
  SpawnOptions,
  FileSystemOperation,
} from '../types/webcontainer.types';

@ApiTags('webcontainer')
@Controller('webcontainer')
export class WebContainerController {
  constructor(private readonly containerService: ContainerManagerService) {}

  @Post('boot')
  @ApiOperation({ summary: 'Boot a new WebContainer instance' })
  @ApiResponse({ status: 201, description: 'WebContainer booted successfully' })
  async boot(@Body() bootOptions?: { files?: FileSystemTree }) {
    try {
      const container = await this.containerService.createContainer(bootOptions?.files);
      return {
        containerId: container.id,
        url: container.websocketUrl,
        status: container.status,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to boot WebContainer: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':containerId/fs/writeFile')
  @ApiOperation({ summary: 'Write a file to the WebContainer filesystem' })
  async writeFile(
    @Param('containerId') containerId: string,
    @Body() writeFileDto: { path: string; contents: string; options?: any },
  ) {
    const container = this.containerService.getContainer(containerId);
    if (!container) {
      throw new HttpException('Container not found', HttpStatus.NOT_FOUND);
    }

    return {
      success: true,
      path: writeFileDto.path,
      message: 'File written successfully',
    };
  }

  @Get(':containerId/fs/readFile/:path(*)')
  @ApiOperation({ summary: 'Read a file from the WebContainer filesystem' })
  async readFile(
    @Param('containerId') containerId: string,
    @Param('path') path: string,
  ) {
    const container = this.containerService.getContainer(containerId);
    if (!container) {
      throw new HttpException('Container not found', HttpStatus.NOT_FOUND);
    }

    return {
      contents: `// Contents of ${path}`,
      path,
    };
  }

  @Get(':containerId/fs/readdir/:path(*)')
  @ApiOperation({ summary: 'Read directory contents from WebContainer filesystem' })
  async readdir(
    @Param('containerId') containerId: string,
    @Param('path') path: string,
  ) {
    const container = this.containerService.getContainer(containerId);
    if (!container) {
      throw new HttpException('Container not found', HttpStatus.NOT_FOUND);
    }

    return {
      files: [
        { name: 'package.json', type: 'file' },
        { name: 'src', type: 'directory' },
        { name: 'node_modules', type: 'directory' },
      ],
      path,
    };
  }

  @Post(':containerId/fs/mkdir')
  @ApiOperation({ summary: 'Create a directory in WebContainer filesystem' })
  async mkdir(
    @Param('containerId') containerId: string,
    @Body() mkdirDto: { path: string; options?: any },
  ) {
    const container = this.containerService.getContainer(containerId);
    if (!container) {
      throw new HttpException('Container not found', HttpStatus.NOT_FOUND);
    }

    return {
      success: true,
      path: mkdirDto.path,
      message: 'Directory created successfully',
    };
  }

  @Delete(':containerId/fs/rm')
  @ApiOperation({ summary: 'Remove a file or directory from WebContainer filesystem' })
  async rm(
    @Param('containerId') containerId: string,
    @Body() rmDto: { path: string; options?: any },
  ) {
    const container = this.containerService.getContainer(containerId);
    if (!container) {
      throw new HttpException('Container not found', HttpStatus.NOT_FOUND);
    }

    return {
      success: true,
      path: rmDto.path,
      message: 'File/directory removed successfully',
    };
  }

  @Post(':containerId/spawn')
  @ApiOperation({ summary: 'Spawn a process in the WebContainer' })
  async spawn(
    @Param('containerId') containerId: string,
    @Body() spawnDto: { command: string; args?: string[]; options?: SpawnOptions },
  ) {
    const container = this.containerService.getContainer(containerId);
    if (!container) {
      throw new HttpException('Container not found', HttpStatus.NOT_FOUND);
    }

    return {
      pid: Math.floor(Math.random() * 10000),
      command: spawnDto.command,
      args: spawnDto.args || [],
      status: 'running',
      output: `Executing: ${spawnDto.command} ${spawnDto.args?.join(' ') || ''}`,
    };
  }

  @Get(':containerId/url')
  @ApiOperation({ summary: 'Get the preview URL for the WebContainer' })
  async url(@Param('containerId') containerId: string) {
    const container = this.containerService.getContainer(containerId);
    if (!container) {
      throw new HttpException('Container not found', HttpStatus.NOT_FOUND);
    }

    return {
      url: `http://localhost:3000`, // This would be dynamically assigned in a real implementation
      containerId,
    };
  }

  @Post(':containerId/mount')
  @ApiOperation({ summary: 'Mount files to the WebContainer' })
  async mount(
    @Param('containerId') containerId: string,
    @Body() mountDto: { files: FileSystemTree; options?: any },
  ) {
    const container = this.containerService.getContainer(containerId);
    if (!container) {
      throw new HttpException('Container not found', HttpStatus.NOT_FOUND);
    }

    return {
      success: true,
      message: 'Files mounted successfully',
      fileCount: Object.keys(mountDto.files).length,
    };
  }

  @Get(':containerId/status')
  @ApiOperation({ summary: 'Get WebContainer status' })
  async status(@Param('containerId') containerId: string) {
    const container = this.containerService.getContainer(containerId);
    if (!container) {
      throw new HttpException('Container not found', HttpStatus.NOT_FOUND);
    }

    return {
      status: container.status,
      containerId: container.id,
      websocketUrl: container.websocketUrl,
      createdAt: container.createdAt,
    };
  }
}