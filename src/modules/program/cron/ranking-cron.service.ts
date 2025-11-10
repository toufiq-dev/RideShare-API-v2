import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProgramService } from '../program.service';
import { RankingPeriod } from '@prisma/client';

@Injectable()
export class RankingCronService {
  private readonly logger = new Logger(RankingCronService.name);

  constructor(private readonly programService: ProgramService) {}

  /**
   * Update overall rankings every hour
   */
  // @Cron('*/2 * * * *', {
  //   timeZone: 'Asia/Dhaka',
  // })
  @Cron(CronExpression.EVERY_12_HOURS, {
    timeZone: 'Asia/Dhaka',
  })
  async updateOverallRankings() {
    this.logger.log('Starting overall rankings update (every 2 minutes)...');

    try {
      // Update rankings for all vehicle types
      await this.updateRankingsForAllVehicleTypes(RankingPeriod.OVERALL);
      this.logger.log('Overall rankings update completed successfully');
    } catch (error) {
      this.logger.error(
        `Error updating overall rankings: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Update daily rankings every day at 2 AM
   */
  @Cron('0 2 * * *', {
    timeZone: 'Asia/Dhaka',
  })
  async updateDailyRankings() {
    this.logger.log('Starting daily rankings update...');

    try {
      // Update rankings for all vehicle types
      await this.updateRankingsForAllVehicleTypes(RankingPeriod.DAILY);
      this.logger.log('Daily rankings update completed successfully');
    } catch (error) {
      this.logger.error(
        `Error updating daily rankings: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Helper method to update rankings for all vehicle types
   */
  private async updateRankingsForAllVehicleTypes(period: RankingPeriod) {
    // Get all unique vehicle types
    const vehicleTypes = await this.programService.getVehicleTypes();

    // Normalize vehicle types to group car types together
    const normalizedVehicleTypes = new Set<string>();
    for (const vehicleTypeId of vehicleTypes) {
      const normalizedId = await this.programService.normalizeVehicleTypeForLeaderboard(
        vehicleTypeId,
      );
      normalizedVehicleTypes.add(normalizedId);
    }

    // Update rankings for each normalized vehicle type (car types will be deduplicated)
    for (const normalizedVehicleTypeId of normalizedVehicleTypes) {
      await this.programService.calculateAndStoreRankings(
        period,
        normalizedVehicleTypeId,
      );
      this.logger.log(
        `Updated ${period} rankings for vehicle type: ${normalizedVehicleTypeId}`,
      );
    }
  }
}
