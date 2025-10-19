import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  NotFoundException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ProgramService } from './program.service';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { PrismaService } from 'src/core/database/database.service';

@ApiTags('Pilot Program')
@Controller('program')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProgramController {
  constructor(
    private readonly programService: ProgramService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('leaderboard')
  @Roles(UserRole.PILOT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get pilot leaderboard',
    description:
      'Fetch top pilots ranked by earnings with vehicle type filtering',
  })
  async getLeaderboard(
    @CurrentUser('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
  ): Promise<any> {
    return this.programService.getLeaderboard(userId, page, pageSize);
  }

  @Get('my-progress')
  @Roles(UserRole.PILOT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get pilot progress and ranking',
    description: "Get current pilot's ranking and progress information",
  })
  async getMyProgress(@CurrentUser('userId') userId: string): Promise<any> {
    // Get pilot ID from user ID
    const pilot = await this.prisma.pilot.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!pilot) {
      throw new NotFoundException('Pilot profile not found');
    }

    return this.programService.getPilotProgress(pilot.id);
  }

  @Get('pilot/:pilotId/progress')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get specific pilot progress',
    description: 'Get ranking and progress information for a specific pilot',
  })
  async getPilotProgress(@Param('pilotId') pilotId: string): Promise<any> {
    return this.programService.getPilotProgress(pilotId);
  }
}
