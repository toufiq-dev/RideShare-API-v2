import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/database.service';
import { RankingPeriod, VehicleTypeNameBD } from '@prisma/client';

@Injectable()
export class ProgramService {
  private readonly logger = new Logger(ProgramService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get leaderboard - SIMPLE VERSION (Following Images)
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
      },
    });

    if (!pilot) {
      throw new NotFoundException('Pilot not found');
    }

    // Find the most recent calculatedAt for the given rankingPeriod and vehicleTypeId
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
          },
        },
        vehicleType: {
          select: {
            name: true,
          },
        },
      },
    });
    console.log(leaderboardData);
    // Find current user's ranking
    const userRanking = leaderboardData.find(
      (entry) => entry.pilotId === pilot.id,
    );
    const userRank = userRanking ? userRanking.rank : null;

    // Transform to leaderboard entries
    const entries = leaderboardData.map((entry) => ({
      pilotId: entry.pilot.id,
      name: entry.pilot.name || 'Unknown Pilot',
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

    return {
      message: 'Leaderboard fetched successfully.',
      data: {
        leaderboard: entries,
        personalRanking: {
          pilotId: pilot.id,
          name: pilot.name || 'Unknown Pilot',
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
      },
    };
  }

  /**
   * Get pilot progress and ranking information (Following Images)
   */
  async getPilotProgress(
    pilotId: string,
    vehicleType?: VehicleTypeNameBD,
  ): Promise<any> {
    const pilot = await this.prisma.pilot.findUnique({
      where: { id: pilotId },
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
        pilotId: pilotId,
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
    const totalPilots = await this.prisma.pilotRanking.count({
      where: {
        rankingPeriod: RankingPeriod.OVERALL,
        vehicleTypeId: vehicleTypeId,
        calculatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    return {
      pilotId: pilot.id,
      name: pilot.name || 'Unknown Pilot',
      profilePicture: pilot.selfieUrl,
      pilotType: pilot.pilotType,
      currentRank: pilot.currentRank, // OVERALL rank
      todayRank: dailyRanking?.rank || null, // DAILY rank (Today's Rank)
      totalPilots,
      totalLifetimeEarnings: Number(pilot.totalLifetimeEarnings),
      totalLifetimeRides: pilot.totalLifetimeRides,
      lastRankUpdate: pilot.lastRankUpdate,
      vehicleType: pilot.primaryVehicleType?.name || 'Unknown',
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

    let pilots: any[] = [];

    if (period === RankingPeriod.OVERALL) {
      // OVERALL: Use cached totalLifetimeEarnings from Pilot model
      pilots = await this.prisma.pilot.findMany({
        where: {
          totalLifetimeEarnings: {
            gte: 10000, // Only pilots with minimum 10,000 earnings
          },
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
    } else if (period === RankingPeriod.DAILY) {
      // DAILY: Aggregate from PilotTrips for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

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
          id: true,
        },
      });

      // Get pilot details for daily trips
      const pilotIds = dailyTrips.map((trip) => trip.pilotId);
      const pilotDetails = await this.prisma.pilot.findMany({
        where: {
          id: { in: pilotIds },
          onlineStatus: { not: 'OFFLINE' },
        },
        select: {
          id: true,
          primaryVehicleTypeId: true,
        },
      });

      pilots = dailyTrips
        .map((trip) => {
          const pilot = pilotDetails.find((p) => p.id === trip.pilotId);
          return {
            id: trip.pilotId,
            totalLifetimeEarnings: trip._sum.amount || 0,
            totalLifetimeRides: trip._count.id || 0,
            primaryVehicleTypeId: pilot?.primaryVehicleTypeId,
          };
        })
        .sort(
          (a, b) =>
            Number(b.totalLifetimeEarnings) - Number(a.totalLifetimeEarnings),
        );
    }

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

    // Store rankings
    await this.prisma.pilotRanking.createMany({
      data: rankingEntries,
      skipDuplicates: true,
    });

    // Update currentRank in Pilot model for quick access (only for OVERALL)
    if (period === RankingPeriod.OVERALL) {
      for (const entry of rankingEntries) {
        await this.prisma.pilot.update({
          where: { id: entry.pilotId },
          data: {
            currentRank: entry.rank,
            lastRankUpdate: calculatedAt,
          },
        });
      }
    }

    this.logger.log(`Rankings calculated and stored for ${totalPilots} pilots`);
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
}
