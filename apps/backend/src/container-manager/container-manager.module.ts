import { Module } from '@nestjs/common';
import { ContainerManagerService } from './container-manager.service';
import { ContainerManagerController } from './container-manager.controller';
import { WebContainerController } from './webcontainer.controller';

@Module({
  controllers: [ContainerManagerController, WebContainerController],
  providers: [ContainerManagerService],
  exports: [ContainerManagerService],
})
export class ContainerManagerModule {}