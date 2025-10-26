import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/database.service';
import {
  PilotType,
  ProgramType,
  RankingPeriod,
  VehicleTypeNameBD,
} from '@prisma/client';

@Injectable()
export class ProgramService {
  private readonly logger = new Logger(ProgramService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get leaderboard - Enhanced with business logic
   */
  async getLeaderboard(
    userId: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<any> {
    const pilot = await this.prisma.pilot.findUnique({
      where: { userId },
      select: {
        id: true,
        primaryVehicleTypeId: true,
        name: true,
        selfieUrl: true,
        pilotType: true,
        totalLifetimeEarnings: true,
        totalLifetimeRides: true,
        primaryVehicleType: {
          select: { name: true },
        },
        drivingLicense: {
          select: {
            nameOnLicense: true,
          },
        },
      },
    });

    if (!pilot) {
      throw new NotFoundException('Pilot not found');
    }

    // Get Super Pilot program criteria
    const superPilotProgram = await this.prisma.pilotProgram.findFirst({
      where: {
        programType: ProgramType.SUPER_PILOT,
        isActive: true,
      },
      select: {
        criteria: true,
      },
    });

    const minEarnings = superPilotProgram
      ? Number((superPilotProgram.criteria as any).minEarnings) || 10000
      : 10000;

    // Check if pilot meets minimum earnings requirement
    if (Number(pilot.totalLifetimeEarnings) < minEarnings) {
      const remainingEarnings =
        minEarnings - Number(pilot.totalLifetimeEarnings);
      return {
        message: `You're so close. Just complete ৳${remainingEarnings.toLocaleString()} to unlock the Super Pilot reward`,
        data: {},
      };
    }

    // Continue with normal leaderboard logic...
    const latestRankingEntry = await this.prisma.pilotRanking.findFirst({
      where: {
        rankingPeriod: RankingPeriod.OVERALL,
        vehicleTypeId: pilot.primaryVehicleTypeId,
      },
      orderBy: {
        calculatedAt: 'desc',
      },
      select: {
        calculatedAt: true,
      },
    });

    if (!latestRankingEntry) {
      // If no rankings exist, calculate them on-the-fly
      await this.calculateAndStoreRankings(
        RankingPeriod.OVERALL,
        pilot.primaryVehicleTypeId,
      );
      return this.getLeaderboard(userId, page, pageSize); // Recursive call after calculation
    }

    const skip = (page - 1) * pageSize;

    const totalCount = await this.prisma.pilotRanking.count({
      where: {
        rankingPeriod: RankingPeriod.OVERALL,
        vehicleTypeId: pilot.primaryVehicleTypeId,
        calculatedAt: latestRankingEntry.calculatedAt,
      },
    });

    // Fetch leaderboard entries for the latest calculatedAt
    const leaderboardData = await this.prisma.pilotRanking.findMany({
      where: {
        rankingPeriod: RankingPeriod.OVERALL,
        vehicleTypeId: pilot.primaryVehicleTypeId,
        calculatedAt: latestRankingEntry.calculatedAt,
      },
      orderBy: {
        rank: 'asc',
      },
      skip,
      take: pageSize,
      include: {
        pilot: {
          select: {
            id: true,
            name: true,
            selfieUrl: true,
            pilotType: true,
            drivingLicense: {
              select: {
                nameOnLicense: true,
              },
            },
          },
        },
        vehicleType: {
          select: {
            name: true,
          },
        },
      },
    });

    // Find current user's ranking
    const userRanking = leaderboardData.find(
      (entry) => entry.pilotId === pilot.id,
    );
    const userRank = userRanking ? userRanking.rank : null;

    // Transform to leaderboard entries
    const entries = leaderboardData.map((entry) => ({
      pilotId: entry.pilot.id,
      name: entry.pilot.drivingLicense?.nameOnLicense || 'Unknown Pilot',
      profilePicture: entry.pilot.selfieUrl,
      totalRides: entry.rides,
      totalEarnings: Number(entry.earnings),
      rank: entry.rank,
      vehicleType: entry.vehicleType?.name || 'Unknown',
      pilotType: entry.pilot.pilotType || 'REGULAR',
    }));

    console.log('entries', leaderboardData);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      message: 'Leaderboard fetched successfully.',
      data: {
        leaderboard: entries,
        personalRanking: {
          pilotId: pilot.id,
          name: pilot.drivingLicense?.nameOnLicense || 'Unknown Pilot',
          profilePicture: pilot.selfieUrl,
          rank: userRank,
          totalRides: pilot.totalLifetimeRides,
          totalEarnings: Number(pilot.totalLifetimeEarnings),
          pilotType: pilot.pilotType || 'REGULAR',
          vehicleType: pilot.primaryVehicleType?.name || 'Unknown',
        },
        lastUpdated: latestRankingEntry.calculatedAt,
        pagination: {
          totalItems: totalCount,
          totalPages,
          currentPage: page,
          pageSize: pageSize,
          hasNextPage,
          hasPrevPage,
        },
        eligibilityStatus: 'ELIGIBLE',
        minEarningsRequired: minEarnings,
      },
    };
  }

  /**
   * Get pilot progress and ranking information (Following Images)
   */
  async getPilotProgress(
    userId: string,
    vehicleType?: VehicleTypeNameBD,
  ): Promise<any> {
    const pilot = await this.prisma.pilot.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        selfieUrl: true,
        pilotType: true,
        primaryVehicleTypeId: true,
        totalLifetimeEarnings: true,
        totalLifetimeRides: true,
        currentRank: true,
        lastRankUpdate: true,
        primaryVehicleType: {
          select: { name: true },
        },
      },
    });

    if (!pilot) {
      throw new NotFoundException('Pilot not found');
    }

    // Get Super Pilot program criteria
    const superPilotProgram = await this.prisma.pilotProgram.findFirst({
      where: {
        programType: ProgramType.SUPER_PILOT,
        isActive: true,
      },
      select: {
        criteria: true,
      },
    });

    const minEarnings = superPilotProgram
      ? Number((superPilotProgram.criteria as any).minEarnings) || 10000
      : 10000;

    if (Number(pilot.totalLifetimeEarnings) < minEarnings) {
      const remainingEarnings =
        minEarnings - Number(pilot.totalLifetimeEarnings);
      return {
        message: `You're so close. Just complete ৳${remainingEarnings.toLocaleString()} to unlock the Super Pilot reward`,
        data: {
          eligibilityStatus: 'NOT_ELIGIBLE',
          minEarningsRequired: minEarnings,
        },
      };
    }

    // Get vehicle type ID for ranking context
    let vehicleTypeId: string | null = null;
    if (vehicleType) {
      const vehicleTypeRecord = await this.prisma.vehicleTypeBD.findUnique({
        where: { name: vehicleType },
        select: { id: true },
      });
      vehicleTypeId = vehicleTypeRecord?.id;
    } else if (pilot.primaryVehicleType) {
      vehicleTypeId = pilot.primaryVehicleTypeId;
    }

    // Get DAILY rank (Today's Rank from images)
    const dailyRanking = await this.prisma.pilotRanking.findFirst({
      where: {
        pilotId: pilot.id,
        rankingPeriod: RankingPeriod.DAILY,
        vehicleTypeId: vehicleTypeId,
      },
      orderBy: {
        calculatedAt: 'desc',
      },
      select: {
        rank: true,
        calculatedAt: true,
      },
    });

    // Get total pilots in OVERALL ranking context
    const totalPilots = await this.prisma.pilot.count({
      where: {
        primaryVehicleTypeId: pilot.primaryVehicleTypeId,
      },
    });

    return {
      message: 'Pilot progress fetched successfully.',
      data: {
        pilotId: pilot.id,
        currentRank: pilot.currentRank, // OVERALL rank
        totalPilots,
      },
    };
  }

  /**
   * Calculate and store rankings (CORE METHOD - OVERALL and DAILY RANKING)
   */
  async calculateAndStoreRankings(
    period: RankingPeriod,
    vehicleTypeId?: string,
  ): Promise<void> {
    this.logger.log(
      `Calculating rankings for period: ${period}, vehicleType: ${vehicleTypeId || 'all'}`,
    );

    // Get Super Pilot program criteria for minimum earnings
    const superPilotProgram = await this.prisma.pilotProgram.findFirst({
      where: {
        programType: ProgramType.SUPER_PILOT,
        isActive: true,
      },
      select: {
        criteria: true,
      },
    });

    const minEarnings = superPilotProgram
      ? Number((superPilotProgram.criteria as any).minEarnings) || 10000
      : 10000;

    let pilots: any[] = [];

    if (period === RankingPeriod.OVERALL) {
      // OVERALL: Use cached totalLifetimeEarnings from Pilot model
      pilots = await this.prisma.pilot.findMany({
        where: {
          totalLifetimeEarnings: {
            gte: minEarnings, // Dynamic minimum earnings from Super Pilot program
          },
        },
        select: {
          id: true,
          totalLifetimeEarnings: true,
          totalLifetimeRides: true,
          primaryVehicleTypeId: true,
          averageRating: true,
          createdAt: true,
        },
        orderBy: [
          { totalLifetimeEarnings: 'desc' },
          { averageRating: 'desc' },
          { createdAt: 'desc' },
        ],
      });
    } else if (period === RankingPeriod.DAILY) {
      // DAILY: Aggregate from PilotTrips for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 🔧 CHANGE 1: Added _count to count trips per pilot
      const dailyTrips = await this.prisma.pilotTrips.groupBy({
        by: ['pilotId'],
        where: {
          date: {
            gte: today,
            lt: tomorrow,
          },
        },
        _sum: {
          amount: true,
        },
        _count: {
          pilotId: true, // ✅ Count number of trips per pilot
        },
      });

      // Filter pilots with minimum lifetime earnings
      const pilotsWithMinEarnings = await this.prisma.pilot.findMany({
        where: {
          totalLifetimeEarnings: {
            gte: minEarnings,
          },
        },
        select: {
          id: true,
          totalLifetimeEarnings: true,
          totalLifetimeRides: true,
          primaryVehicleTypeId: true,
          averageRating: true,
          createdAt: true,
        },
      });

      // Map daily trips to pilots
      pilots = dailyTrips
        .map((trip) => {
          const pilot = pilotsWithMinEarnings.find(
            (p) => p.id === trip.pilotId,
          );
          if (!pilot) return null;

          return {
            id: pilot.id,
            totalLifetimeEarnings: pilot.totalLifetimeEarnings,
            totalLifetimeRides: pilot.totalLifetimeRides,
            primaryVehicleTypeId: pilot.primaryVehicleTypeId,
            averageRating: pilot.averageRating ?? 0,
            createdAt: pilot.createdAt,
            dailyEarnings: Number(trip._sum.amount || 0),
            dailyRides: trip._count?.pilotId || 0,
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          // 1) higher daily earnings first
          const earnCmp = Number(b.dailyEarnings) - Number(a.dailyEarnings);
          if (earnCmp !== 0) return earnCmp;
          // 2) higher average rating next
          const ratingCmp =
            Number(b.averageRating ?? 0) - Number(a.averageRating ?? 0);
          if (ratingCmp !== 0) return ratingCmp;
          // 3) earlier createdAt wins
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
    }

    this.logger.log(`Found ${pilots.length} pilots for ranking calculation`);

    // Filter by vehicle type if specified
    const filteredPilots = vehicleTypeId
      ? pilots.filter((pilot) => pilot.primaryVehicleTypeId === vehicleTypeId)
      : pilots;

    const totalPilots = filteredPilots.length;
    const calculatedAt = new Date();

    // Create ranking entries
    const rankingEntries = filteredPilots.map((pilot, index) => {
      const entry: any = {
        pilotId: pilot.id,
        rank: index + 1,
        earnings: pilot.totalLifetimeEarnings,
        rides: pilot.totalLifetimeRides,
        totalPilots: totalPilots,
        rankingPeriod: period,
        calculatedAt: calculatedAt,
      };

      // Only add vehicleTypeId if it's not null
      if (vehicleTypeId) {
        entry.vehicleTypeId = vehicleTypeId;
      }

      return entry;
    });

    if (rankingEntries.length === 0) {
      this.logger.log('No pilots to rank');
      return;
    }

    // Store rankings in database
    await this.prisma.pilotRanking.createMany({
      data: rankingEntries,
      skipDuplicates: true,
    });

    // Update pilot's current rank
    for (const entry of rankingEntries) {
      await this.prisma.pilot.update({
        where: { id: entry.pilotId },
        data: {
          currentRank: entry.rank,
          lastRankUpdate: calculatedAt,
        },
      });
    }

    this.logger.log(
      `Successfully calculated and stored ${rankingEntries.length} rankings for ${period} period`,
    );
  }

  /**
   * Get all unique vehicle types for ranking updates
   */
  async getVehicleTypes(): Promise<string[]> {
    try {
      const vehicleTypes = await this.prisma.vehicleTypeBD.findMany({
        select: { id: true },
      });
      return vehicleTypes.map((vt) => vt.id);
    } catch (error) {
      this.logger.error('Error fetching vehicle types:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Check Super Pilot promotion within a transaction
   */
  async checkSuperPilotPromotionInTransaction(
    pilotId: string,
    tx: any, // Prisma transaction
  ): Promise<void> {
    try {
      // Get pilot data within transaction
      const pilot = await tx.pilot.findUnique({
        where: { id: pilotId },
        select: {
          id: true,
          pilotType: true,
          totalLifetimeEarnings: true,
          totalLifetimeRides: true,
          averageRating: true,
        },
      });

      if (!pilot || pilot.pilotType === PilotType.SUPER_PILOT) {
        return; // Already Super Pilot or pilot not found
      }

      // Get Super Pilot program criteria
      const superPilotProgram = await tx.pilotProgram.findFirst({
        where: {
          programType: ProgramType.SUPER_PILOT,
          isActive: true,
        },
        select: {
          id: true,
          criteria: true,
          name: true,
        },
      });

      if (!superPilotProgram) {
        console.log('No active Super Pilot program found');
        return;
      }

      // Parse criteria and check if pilot meets requirements
      const criteria = superPilotProgram.criteria as any;
      const minEarnings = Number(criteria.minEarnings) || 10000;

      const meetsCriteria = Number(pilot.totalLifetimeEarnings) >= minEarnings;

      if (meetsCriteria) {
        await this.promoteToSuperPilotInTransaction(
          pilotId,
          superPilotProgram.id,
          tx,
        );
        console.log(
          `🎉 Pilot ${pilotId} promoted to Super Pilot! Earnings: ${pilot.totalLifetimeEarnings}`,
        );
      } else {
        console.log(
          `⏳ Pilot ${pilotId} needs ${minEarnings - Number(pilot.totalLifetimeEarnings)} more earnings to become Super Pilot`,
        );
      }
    } catch (error) {
      console.error(
        'Error checking Super Pilot promotion in transaction:',
        error,
      );
    }
  }

  /**
   * Promote pilot to Super Pilot within a transaction
   */
  private async promoteToSuperPilotInTransaction(
    pilotId: string,
    programId: string,
    tx: any,
  ): Promise<void> {
    // Update pilot type
    await tx.pilot.update({
      where: { id: pilotId },
      data: {
        pilotType: PilotType.SUPER_PILOT,
        superPilotSince: new Date(),
        lastRankUpdate: new Date(),
      },
    });

    // Create or update program enrollment
    await tx.pilotProgramEnrollment.upsert({
      where: {
        pilotId_programId: {
          pilotId,
          programId,
        },
      },
      create: {
        pilotId,
        programId,
        enrolledAt: new Date(),
        achievedAt: new Date(),
        isCurrentlyActive: true,
      },
      update: {
        achievedAt: new Date(),
        isCurrentlyActive: true,
      },
    });

    console.log(
      `✅ Pilot ${pilotId} successfully promoted to Super Pilot in transaction`,
    );
  }

  /**
   * Update rankings within a transaction (simplified version)
   */
  async updateRankingsInTransaction(
    vehicleTypeId: string | null,
    tx: any,
  ): Promise<void> {
    try {
      // Get Super Pilot program criteria
      const superPilotProgram = await tx.pilotProgram.findFirst({
        where: {
          programType: ProgramType.SUPER_PILOT,
          isActive: true,
        },
        select: {
          criteria: true,
        },
      });

      const minEarnings = superPilotProgram
        ? Number((superPilotProgram.criteria as any).minEarnings) || 10000
        : 10000;

      // Get eligible pilots
      const pilots = await tx.pilot.findMany({
        where: {
          totalLifetimeEarnings: {
            gte: minEarnings,
          },
          ...(vehicleTypeId && { primaryVehicleTypeId: vehicleTypeId }),
        },
        select: {
          id: true,
          totalLifetimeEarnings: true,
          totalLifetimeRides: true,
          primaryVehicleTypeId: true,
        },
        orderBy: {
          totalLifetimeEarnings: 'desc',
        },
      });

      if (pilots.length === 0) {
        return;
      }

      const calculatedAt = new Date();

      // Create ranking entries
      const rankingEntries = pilots.map((pilot: any, index: number) => {
        const entry: any = {
          pilotId: pilot.id,
          rank: index + 1,
          earnings: pilot.totalLifetimeEarnings,
          rides: pilot.totalLifetimeRides,
          totalPilots: pilots.length,
          rankingPeriod: RankingPeriod.OVERALL,
          calculatedAt: calculatedAt,
        };

        if (vehicleTypeId) {
          entry.vehicleTypeId = vehicleTypeId;
        }

        return entry;
      });

      // Store rankings
      await tx.pilotRanking.createMany({
        data: rankingEntries,
        skipDuplicates: true,
      });

      // Update pilot ranks
      for (const entry of rankingEntries) {
        await tx.pilot.update({
          where: { id: entry.pilotId },
          data: {
            currentRank: entry.rank,
            lastRankUpdate: calculatedAt,
          },
        });
      }

      console.log(
        `✅ Updated ${rankingEntries.length} rankings in transaction for vehicle type: ${vehicleTypeId || 'all'}`,
      );
    } catch (error) {
      console.error('Error updating rankings in transaction:', error);
    }
  }

  /**
   * Get tutorial list
   */
  async getTutorialList(): Promise<any> {
    const tutorials = await this.prisma.videoTutorial.findMany({
      orderBy: { order: 'asc' },
      select: {
        id: true,
        title: true,
        videoUrl: true,
        duration: true,
        order: true,
        isRequired: true,
      },
    });

    return {
      message: 'Tutorial list fetched successfully.',
      data: tutorials,
    };
  }
}
