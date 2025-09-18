import { Module } from '@nestjs/common';
import { ContainerManagerModule } from './container-manager/container-manager.module';
import { WebSocketModule } from './websocket/websocket.module';

@Module({
  imports: [ContainerManagerModule, WebSocketModule],
})
export class AppModule {}