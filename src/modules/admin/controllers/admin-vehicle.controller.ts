import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FilterVehicleTypeBDFilterDto } from '../dto/admin-vehicle-type-filter.dto';
import { AdminService } from '../services/admin.service';

@ApiTags('admin-vehicle')
@Controller('admin')
export class AdminVehicleController {
  constructor(private readonly adminService: AdminService) {}

  @Get('vehicle-types-list-bd')
  @ApiOperation({ summary: 'Vehicle Type BD List' })
  async getVehicleTypeBDList(@Query() query: FilterVehicleTypeBDFilterDto) {
    return await this.adminService.getVehicleTypesListBD(query);
  }
}
