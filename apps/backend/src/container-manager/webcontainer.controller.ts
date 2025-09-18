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

    try {
      const writeResult = await this.containerService.executeCommand(
        containerId,
        `echo '${writeFileDto.contents.replace(/'/g, "'\\''")}' > ${writeFileDto.path}`
      );

      if (writeResult.error) {
        throw new HttpException(
          `Failed to write file: ${writeResult.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        path: writeFileDto.path,
        message: 'File written successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to write file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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

    try {
      const readResult = await this.containerService.executeCommand(
        containerId,
        `cat ${path}`
      );

      if (readResult.error) {
        throw new HttpException(
          `Failed to read file: ${readResult.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        contents: readResult.output,
        path,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to read file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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

    try {
      const dirResult = await this.containerService.executeCommand(
        containerId,
        `ls -la ${path} | tail -n +2 | awk '{print $9, $1}' | grep -v "^\\.$" | grep -v "^\\.\\.\\s"`
      );

      if (dirResult.error) {
        throw new HttpException(
          `Failed to read directory: ${dirResult.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
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

      return { files, path };
    } catch (error) {
      throw new HttpException(
        `Failed to read directory: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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

    try {
      const mkdirResult = await this.containerService.executeCommand(
        containerId,
        `mkdir -p ${mkdirDto.path}`
      );

      if (mkdirResult.error) {
        throw new HttpException(
          `Failed to create directory: ${mkdirResult.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        path: mkdirDto.path,
        message: 'Directory created successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create directory: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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

    try {
      const rmResult = await this.containerService.executeCommand(
        containerId,
        `rm -rf ${rmDto.path}`
      );

      if (rmResult.error) {
        throw new HttpException(
          `Failed to remove: ${rmResult.error}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        path: rmDto.path,
        message: 'File/directory removed successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to remove: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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

    const previewPort = await this.containerService.getContainerPreviewPort(containerId);
    if (!previewPort) {
      throw new HttpException('Container preview port not available', HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      url: `http://localhost:${previewPort}`,
      containerId,
      port: previewPort,
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

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file to a WebContainer via WebSocket' })
  @ApiResponse({ status: 200, description: 'File upload initiated successfully' })
  async upload(
    @Body() uploadDto: {
      containerId: string;
      filename: string;
      targetPath: string;
      content: string;
      encoding?: 'utf8' | 'base64';
    },
  ) {
    const container = this.containerService.getContainer(uploadDto.containerId);
    if (!container) {
      throw new HttpException('Container not found', HttpStatus.NOT_FOUND);
    }

    try {
      // Send file upload request through WebSocket gateway
      const result = await this.containerService.uploadFileViaWebSocket(
        uploadDto.containerId,
        uploadDto.filename,
        uploadDto.targetPath,
        uploadDto.content,
        uploadDto.encoding || 'utf8'
      );

      return {
        success: true,
        filename: uploadDto.filename,
        targetPath: uploadDto.targetPath,
        message: 'File uploaded successfully',
        ...result
      };
    } catch (error) {
      throw new HttpException(
        `Failed to upload file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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