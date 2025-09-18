import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ContainerManagerService } from './container-manager.service';
import { ContainerInfo, FileSystemTree } from '../types/webcontainer.types';

@ApiTags('containers')
@Controller('containers')
export class ContainerManagerController {
  constructor(private readonly containerService: ContainerManagerService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new container' })
  @ApiResponse({ status: 201, description: 'Container created successfully' })
  async createContainer(
    @Body() createContainerDto?: { files?: FileSystemTree }
  ): Promise<ContainerInfo> {
    try {
      return await this.containerService.createContainer(createContainerDto?.files);
    } catch (error) {
      throw new HttpException(
        `Failed to create container: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a container' })
  @ApiResponse({ status: 200, description: 'Container deleted successfully' })
  async deleteContainer(@Param('id') id: string): Promise<{ message: string }> {
    try {
      await this.containerService.deleteContainer(id);
      return { message: 'Container deleted successfully' };
    } catch (error) {
      throw new HttpException(
        `Failed to delete container: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get container information' })
  @ApiResponse({ status: 200, description: 'Container information retrieved' })
  getContainer(@Param('id') id: string): ContainerInfo {
    const container = this.containerService.getContainer(id);
    if (!container) {
      throw new HttpException('Container not found', HttpStatus.NOT_FOUND);
    }
    return container;
  }

  @Get()
  @ApiOperation({ summary: 'Get all containers' })
  @ApiResponse({ status: 200, description: 'All containers retrieved' })
  getAllContainers(): ContainerInfo[] {
    return this.containerService.getAllContainers();
  }

  @Get(':id/url')
  @ApiOperation({ summary: 'Get the preview URL for the container' })
  @ApiResponse({ status: 200, description: 'Preview URL retrieved' })
  async getContainerUrl(@Param('id') id: string) {
    const container = this.containerService.getContainer(id);
    if (!container) {
      throw new HttpException('Container not found', HttpStatus.NOT_FOUND);
    }

    const previewPort = await this.containerService.getContainerPreviewPort(id);
    if (!previewPort) {
      throw new HttpException('Container preview port not available', HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      url: `http://localhost:${previewPort}`,
      containerId: id,
      port: previewPort,
    };
  }
}