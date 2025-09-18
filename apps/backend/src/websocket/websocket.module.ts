import { Module } from '@nestjs/common';
import { ContainerGateway } from './container.gateway';
import { ContainerManagerModule } from '../container-manager/container-manager.module';

@Module({
  imports: [ContainerManagerModule],
  providers: [ContainerGateway],
})
export class WebSocketModule {}