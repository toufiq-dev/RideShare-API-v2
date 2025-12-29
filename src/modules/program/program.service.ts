import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/database.service';
import {
  PilotType,
  ProgramType,
  RankingPeriod,
  VehicleTypeNameBD,
} from '@prisma/client';
import { AzureService } from 'src/core/utils/azure.util';
import { ConfigService } from '@nestjs/config';
import { EligibilityStatus } from './dto/leaderboard.dto';

@Injectable()
export class ProgramService {
  private readonly logger = new Logger(ProgramService.name);
  private readonly allowedMimeTypes: string[];
  private readonly maxFileSize: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly azureService: AzureService,
    private readonly configService: ConfigService,
  ) {
    this.allowedMimeTypes = this.configService.get<string[]>(
      'file.allowedMimeTypes',
    );
    this.maxFileSize =
      this.configService.get<number>('file.maxVideoSize') || 100 * 1024 * 1024;
  }

  /**
   * Get leaderboard - Enhanced with business logic
   */
  async getLeaderboard(
    userId: string,
    page: number = 1,
    pageSize: number = 10,
    recursionDepth: number = 0,
  ): Promise<any> {
    // Prevent infinite recursion
    if (recursionDepth > 1) {
      throw new BadRequestException(
        'Unable to calculate rankings. Please try again later.',
      );
    }

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
        currentRank: true,
        primaryVehicleType: {
          select: { name: true },
        },
        vehicle: {
          select: {
            vehicleTypeBD: {
              select: {
                id: true,
              },
            },
          },
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
    // if (Number(pilot.totalLifetimeEarnings) < minEarnings) {
    //   const remainingEarnings =
    //     minEarnings - Number(pilot.totalLifetimeEarnings);
    //   return {
    //     message: `You're so close. Just complete ৳${remainingEarnings.toLocaleString()} to unlock the Super Pilot reward`,
    //     data: {},
    //   };
    // }

    const rawVehicleTypeId =
      pilot.primaryVehicleTypeId || pilot.vehicle?.vehicleTypeBD?.id;

    if (!rawVehicleTypeId) {
      throw new BadRequestException(
        'Pilot vehicle type information is missing.',
      );
    }

    const normalizedVehicleTypeId =
      await this.normalizeVehicleTypeForLeaderboard(rawVehicleTypeId);

    // Continue with normal leaderboard logic...
    const latestRankingEntry = await this.prisma.pilotRanking.findFirst({
      where: {
        rankingPeriod: RankingPeriod.OVERALL,
        vehicleTypeId: normalizedVehicleTypeId,
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
        normalizedVehicleTypeId,
      );
      return this.getLeaderboard(userId, page, pageSize, recursionDepth + 1); // Recursive call after calculation
    }

    const skip = (page - 1) * pageSize;

    const totalCount = await this.prisma.pilotRanking.count({
      where: {
        rankingPeriod: RankingPeriod.OVERALL,
        vehicleTypeId: normalizedVehicleTypeId,
        calculatedAt: latestRankingEntry.calculatedAt,
      },
    });

    // Fetch leaderboard entries for the latest calculatedAt
    const leaderboardData = await this.prisma.pilotRanking.findMany({
      where: {
        rankingPeriod: RankingPeriod.OVERALL,
        vehicleTypeId: normalizedVehicleTypeId,
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

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const isNotEligible = Number(pilot.totalLifetimeEarnings) < minEarnings;

    return {
      message: 'Leaderboard fetched successfully.',
      data: {
        leaderboard: entries,
        personalRanking: isNotEligible
          ? null
          : {
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
        eligibilityStatus: isNotEligible
          ? EligibilityStatus.NOT_ELIGIBLE
          : EligibilityStatus.ELIGIBLE,
        minEarningsRequired: minEarnings,
      },
    };
  }

  /**
   * Get pilot progress and ranking information (Following Images)
   */
  async getPilotProgress(userId: string): Promise<any> {
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
        vehicle: {
          select: {
            vehicleTypeBD: {
              select: {
                id: true,
              },
            },
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

    if (Number(pilot.totalLifetimeEarnings) < minEarnings) {
      const remainingEarnings =
        minEarnings - Number(pilot.totalLifetimeEarnings);
      return {
        message: `You're so close. Just complete ৳${remainingEarnings.toLocaleString()} to unlock into pilot program`,
        data: {
          eligibilityStatus: EligibilityStatus.NOT_ELIGIBLE,
          minEarningsRequired: minEarnings,
        },
      };
    }

    const rawVehicleTypeId =
      pilot.primaryVehicleTypeId || pilot.vehicle?.vehicleTypeBD?.id;

    // Add validation before using vehicleTypeId
    if (!rawVehicleTypeId) {
      throw new BadRequestException(
        'Pilot vehicle type information is missing.',
      );
    }

    const normalizedVehicleTypeId =
      await this.normalizeVehicleTypeForLeaderboard(rawVehicleTypeId);

    const latestRankingEntry = await this.prisma.pilotRanking.findFirst({
      where: {
        rankingPeriod: RankingPeriod.OVERALL,
        vehicleTypeId: normalizedVehicleTypeId,
      },
      orderBy: {
        calculatedAt: 'desc',
      },
      select: {
        calculatedAt: true,
      },
    });

    let overallRank = pilot.currentRank; // Fallback
    if (latestRankingEntry) {
      const overallRanking = await this.prisma.pilotRanking.findFirst({
        where: {
          pilotId: pilot.id,
          rankingPeriod: RankingPeriod.OVERALL,
          vehicleTypeId: normalizedVehicleTypeId,
          calculatedAt: latestRankingEntry.calculatedAt,
        },
        select: {
          rank: true,
        },
      });
      overallRank = overallRanking?.rank || pilot.currentRank;
    }

    // Get DAILY rank (Today's Rank from images)
    const dailyRanking = await this.prisma.pilotRanking.findFirst({
      where: {
        pilotId: pilot.id,
        rankingPeriod: RankingPeriod.DAILY,
        vehicleTypeId: normalizedVehicleTypeId,
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
    // Handle vehicle type grouping for car types
    let totalPilotsFilter: any = {};

    // Check if normalized vehicle type is a car type
    const normalizedVehicleType = await this.prisma.vehicleTypeBD.findUnique({
      where: { id: normalizedVehicleTypeId },
      select: { name: true },
    });

    const carTypes: VehicleTypeNameBD[] = [
      VehicleTypeNameBD.FAIR_GO,
      VehicleTypeNameBD.FAIR_ELITE,
      VehicleTypeNameBD.FAIR_MAX,
    ];
    if (
      normalizedVehicleType &&
      carTypes.includes(normalizedVehicleType.name)
    ) {
      // If it's a car type, get all car type IDs and count all car pilots
      const carTypeIds = await this.prisma.vehicleTypeBD.findMany({
        where: {
          name: {
            in: carTypes,
          },
        },
        select: { id: true },
      });

      totalPilotsFilter = {
        OR: [
          {
            primaryVehicleTypeId: {
              in: carTypeIds.map((vt) => vt.id),
            },
          },
          {
            vehicle: {
              vehicleTypeBD: {
                id: {
                  in: carTypeIds.map((vt) => vt.id),
                },
              },
            },
          },
        ],
      };
    } else {
      // For non-car types, exact match
      totalPilotsFilter = {
        OR: [
          { primaryVehicleTypeId: normalizedVehicleTypeId },
          {
            vehicle: {
              vehicleTypeBD: {
                id: normalizedVehicleTypeId,
              },
            },
          },
        ],
      };
    }

    const totalPilots = await this.prisma.pilot.count({
      where: totalPilotsFilter,
    });

    return {
      message: 'Pilot progress fetched successfully.',
      data: {
        pilotId: pilot.id,
        currentRank: overallRank,
        totalPilots,
      },
    };
  }

  /**
   * Calculate and store rankings (CORE METHOD - OVERALL and DAILY RANKING)
   */
  async calculateAndStoreRankings(
    period: RankingPeriod,
    vehicleTypeId: string,
  ): Promise<void> {
    if (!vehicleTypeId) {
      throw new BadRequestException(
        'vehicleTypeId is required for ranking calculations',
      );
    }

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
          vehicle: {
            select: {
              vehicleTypeBD: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [
          { totalLifetimeEarnings: 'desc' },
          { averageRating: 'desc' },
          { createdAt: 'asc' },
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
          pilotId: true, // Count number of trips per pilot
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
          vehicle: {
            select: {
              vehicleTypeBD: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
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
            primaryVehicleTypeId:
              pilot.vehicle?.vehicleTypeBD?.id || pilot.primaryVehicleTypeId,
            vehicleTypeName: pilot.vehicle?.vehicleTypeBD?.name,
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

    // FIX: Filter by normalized vehicle type
    // Get the vehicle type name for the provided vehicleTypeId
    const targetVehicleType = await this.prisma.vehicleTypeBD.findUnique({
      where: { id: vehicleTypeId },
      select: { name: true },
    });

    const carTypes = ['FAIR_PRIME', 'FAIR_PLUS', 'FAIR_MAX'];
    const isTargetCarType = targetVehicleType
      ? carTypes.includes(targetVehicleType.name)
      : false;

    const filteredPilots = pilots.filter((pilot) => {
      const pilotVehicleTypeId =
        pilot.vehicle?.vehicleTypeBD?.id || pilot.primaryVehicleTypeId;
      const pilotVehicleTypeName = pilot.vehicle?.vehicleTypeBD?.name;

      if (!pilotVehicleTypeId) return false;

      // If target is a car type, include all car types
      if (isTargetCarType && pilotVehicleTypeName) {
        return carTypes.includes(pilotVehicleTypeName);
      }

      // Otherwise, exact match
      return pilotVehicleTypeId === vehicleTypeId;
    });

    const totalPilots = filteredPilots.length;
    const calculatedAt = new Date();

    // Create ranking entries
    const rankingEntries = filteredPilots.map((pilot, index) => {
      return {
        pilotId: pilot.id,
        rank: index + 1,
        earnings: pilot.totalLifetimeEarnings,
        rides: pilot.totalLifetimeRides,
        totalPilots: totalPilots,
        rankingPeriod: period,
        calculatedAt: calculatedAt,
        vehicleTypeId: vehicleTypeId,
      };
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
    tx: any,
  ): Promise<void> {
    try {
      // Get pilot data within transaction - ADD currentRank and primaryVehicleTypeId
      const pilot = await tx.pilot.findUnique({
        where: { id: pilotId },
        select: {
          id: true,
          pilotType: true,
          totalLifetimeEarnings: true,
          totalLifetimeRides: true,
          averageRating: true,
          currentRank: true,
          primaryVehicleTypeId: true,
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

      // Parse criteria
      const criteria = superPilotProgram.criteria as any;
      const minEarnings = Number(criteria.minEarnings) || 10000;
      const maxSuperPilots = Number(criteria.maxSuperPilots) || 1000;

      if (!pilot.currentRank) {
        console.log(
          `Pilot ${pilotId} has no current rank yet (not eligible for promotion)`,
        );
        return;
      }

      // Check earnings requirement
      const meetsEarningsCriteria =
        Number(pilot.totalLifetimeEarnings) >= minEarnings;

      const meetsRankCriteria = pilot.currentRank <= maxSuperPilots;

      const currentSuperPilotsCount = await tx.pilot.count({
        where: {
          pilotType: PilotType.SUPER_PILOT,
        },
      });

      const hasCapacityForMore = currentSuperPilotsCount < maxSuperPilots;

      const meetsCriteria =
        meetsEarningsCriteria && meetsRankCriteria && hasCapacityForMore;

      if (meetsCriteria) {
        await this.promoteToSuperPilotInTransaction(
          pilotId,
          superPilotProgram.id,
          tx,
        );
        console.log(
          `Pilot ${pilotId} promoted to Super Pilot! Earnings: ${pilot.totalLifetimeEarnings}, Rank: ${pilot.currentRank}`,
        );
      } else {
        if (!meetsEarningsCriteria) {
          console.log(
            `Pilot ${pilotId} needs ${minEarnings - Number(pilot.totalLifetimeEarnings)} more earnings`,
          );
        }
        if (!meetsRankCriteria) {
          console.log(
            `Pilot ${pilotId} rank ${pilot.currentRank} is outside top ${maxSuperPilots}`,
          );
        }
        if (!hasCapacityForMore) {
          console.log(
            `Already at max capacity of ${maxSuperPilots} Super Pilots (current: ${currentSuperPilotsCount})`,
          );
        }
      }
    } catch (error) {
      console.error(
        'Error checking Super Pilot promotion in transaction:',
        error,
      );
    }
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

      const maxSuperPilots = superPilotProgram
        ? Number((superPilotProgram.criteria as any).maxSuperPilots) || 1000
        : 1000;

      //  FIX: Handle vehicle type grouping for car types
      let vehicleTypeFilter: any = {};
      if (vehicleTypeId) {
        // Get vehicle type name to check if it's a car type
        const vehicleType = await tx.vehicleTypeBD.findUnique({
          where: { id: vehicleTypeId },
          select: { name: true },
        });

        const carTypes = ['FAIR_PRIME', 'FAIR_PLUS', 'FAIR_MAX'];
        if (vehicleType && carTypes.includes(vehicleType.name)) {
          // If it's a car type, get all car type IDs
          const carTypeIds = await tx.vehicleTypeBD.findMany({
            where: {
              name: {
                in: carTypes,
              },
            },
            select: { id: true },
          });
          vehicleTypeFilter = {
            primaryVehicleTypeId: {
              in: carTypeIds.map((vt) => vt.id),
            },
          };
        } else {
          // For non-car types, exact match
          vehicleTypeFilter = { primaryVehicleTypeId: vehicleTypeId };
        }
      }

      // Get eligible pilots
      const pilots = await tx.pilot.findMany({
        where: {
          totalLifetimeEarnings: {
            gte: minEarnings,
          },
          ...vehicleTypeFilter,
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
          { createdAt: 'asc' },
        ],
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
        `Updated ${rankingEntries.length} rankings in transaction for vehicle type: ${vehicleTypeId || 'all'}`,
      );

      // Check and demote Super Pilots who fell out of top rankings
      await this.demoteSuperPilotsOutOfTopInTransaction(
        vehicleTypeId,
        maxSuperPilots,
        tx,
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

  async uploadSuperPilotVideo(
    userId: string,
    videoFile: Express.Multer.File,
  ): Promise<any> {
    try {
      // Verify pilot exists
      const pilot = await this.prisma.pilot.findUnique({
        where: { userId },
        select: {
          id: true,
          pilotType: true,
          superPilotSince: true,
          superPilotVideoUrl: true,
          name: true,
        },
      });

      if (!pilot) {
        throw new NotFoundException('Pilot not found');
      }

      // Verify pilot is a Super Pilot
      if (pilot.pilotType !== PilotType.SUPER_PILOT) {
        throw new ForbiddenException(
          'Only Super Pilots can upload this videos.',
        );
      }

      if (pilot.superPilotVideoUrl) {
        throw new BadRequestException(
          'Super Pilot video has already been uploaded. Contact support to update.',
        );
      }

      if (!this.allowedMimeTypes.includes(videoFile.mimetype)) {
        throw new BadRequestException('Invalid video file type.');
      }

      if (videoFile.size > this.maxFileSize) {
        throw new BadRequestException('Video file size exceeds the limit.');
      }

      // Get video buffer
      const videoBuffer = videoFile.buffer;

      // Upload to Azure Blob Storage using AzureService
      const videoUrl = await this.azureService.uploadFile(
        videoBuffer,
        videoFile.originalname,
        userId,
        videoFile.mimetype,
      );

      // Save video URL to database
      await this.prisma.pilot.update({
        where: { id: pilot.id },
        data: {
          superPilotVideoUrl: videoUrl,
          superPilotVideoUploadedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Your video has been uploaded successfully',
        data: {
          videoUrl,
          uploadedAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error uploading super pilot video for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Normalize vehicle type ID for leaderboard grouping
   * Car types (FAIR_PRIME, FAIR_PLUS, FAIR_MAX) are grouped together
   * Other types (FAIR_BIKE, FAIR_CNG) remain separate
   */
  async normalizeVehicleTypeForLeaderboard(
    vehicleTypeId: string,
  ): Promise<string> {
    if (!vehicleTypeId) {
      return vehicleTypeId;
    }

    // Get vehicle type name from database
    const vehicleType = await this.prisma.vehicleTypeBD.findUnique({
      where: { id: vehicleTypeId },
      select: { name: true },
    });

    if (!vehicleType) {
      return vehicleTypeId; // Return original if not found
    }

    // Car types that should be grouped together
    const carTypes = ['FAIR_PRIME', 'FAIR_PLUS', 'FAIR_MAX'];

    // If it's a car type, get the ID of FAIR_PRIME (or first car type) as the normalized ID
    if (carTypes.includes(vehicleType.name)) {
      const normalizedCarType = await this.prisma.vehicleTypeBD.findFirst({
        where: { name: 'FAIR_ELITE' },
        select: { id: true },
      });
      return normalizedCarType?.id || vehicleTypeId;
    }

    // For non-car types, return the original ID
    return vehicleTypeId;
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
      `Pilot ${pilotId} successfully promoted to Super Pilot in transaction`,
    );
  }

  /**
   * Demote Super Pilots who fell out of top maxSuperPilots
   */
  private async demoteSuperPilotsOutOfTopInTransaction(
    vehicleTypeId: string | null,
    maxSuperPilots: number,
    tx: any,
  ): Promise<void> {
    try {
      // Get program ID
      const superPilotProgram = await tx.pilotProgram.findFirst({
        where: {
          programType: ProgramType.SUPER_PILOT,
          isActive: true,
        },
        select: { id: true },
      });

      if (!superPilotProgram) return;

      // FIX: Handle vehicle type grouping for car types
      // Get all Super Pilots (filter by vehicle type if specified)
      let vehicleTypeFilter: any = {};
      if (vehicleTypeId) {
        // Get vehicle type name to check if it's a car type
        const vehicleType = await tx.vehicleTypeBD.findUnique({
          where: { id: vehicleTypeId },
          select: { name: true },
        });

        const carTypes = ['FAIR_PRIME', 'FAIR_PLUS', 'FAIR_MAX'];
        if (vehicleType && carTypes.includes(vehicleType.name)) {
          // If it's a car type, get all car type IDs
          const carTypeIds = await tx.vehicleTypeBD.findMany({
            where: {
              name: {
                in: carTypes,
              },
            },
            select: { id: true },
          });
          vehicleTypeFilter = {
            primaryVehicleTypeId: {
              in: carTypeIds.map((vt) => vt.id),
            },
          };
        } else {
          // For non-car types, exact match
          vehicleTypeFilter = { primaryVehicleTypeId: vehicleTypeId };
        }
      }

      const superPilots = await tx.pilot.findMany({
        where: {
          pilotType: PilotType.SUPER_PILOT,
          ...vehicleTypeFilter, // Use grouped filter
        },
        select: {
          id: true,
          currentRank: true,
        },
      });

      // Demote pilots outside top maxSuperPilots
      const pilotsToDemote = superPilots.filter(
        (pilot) => !pilot.currentRank || pilot.currentRank > maxSuperPilots,
      );

      if (pilotsToDemote.length === 0) {
        return; // No demotions needed
      }

      console.log(
        `Demoting ${pilotsToDemote.length} Super Pilots who fell out of top ${maxSuperPilots}`,
      );

      // Demote each pilot
      for (const pilot of pilotsToDemote) {
        // Update pilot type to REGULAR
        await tx.pilot.update({
          where: { id: pilot.id },
          data: {
            pilotType: PilotType.REGULAR,
            superPilotSince: null,
          },
        });

        // Update enrollment status to inactive
        await tx.pilotProgramEnrollment.updateMany({
          where: {
            pilotId: pilot.id,
            programId: superPilotProgram.id,
          },
          data: {
            isCurrentlyActive: false,
          },
        });

        console.log(
          `Demoted pilot ${pilot.id} from Super Pilot (rank: ${pilot.currentRank})`,
        );
      }
    } catch (error) {
      console.error('Error demoting Super Pilots:', error);
    }
  }
}
