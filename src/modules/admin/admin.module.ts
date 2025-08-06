import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AzureService } from 'src/core/utils/azure.util';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AzureService],
})
export class AdminModule {}
