import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { FilterVehicleTypeBDFilterDto } from '../dto/admin-vehicle-type-filter.dto';
import { AdminService } from '../services/admin.service';

@ApiTags('admin-vehicle')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@ApiBearerAuth()
export class AdminVehicleController {
  constructor(private readonly adminService: AdminService) {}

  @Get('vehicle-types-list-bd')
  @ApiOperation({ summary: 'Vehicle Type BD List' })
  async getVehicleTypeBDList(@Query() query: FilterVehicleTypeBDFilterDto) {
    return await this.adminService.getVehicleTypesListBD(query);
  }
}
