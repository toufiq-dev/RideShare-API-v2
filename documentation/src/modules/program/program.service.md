# `src/modules/program/program.service.ts`

## Role

**Pilot programs** (e.g. Super Pilot): leaderboards, eligibility, earnings/rides aggregation, video upload to Azure for challenges, rank calculation with recursion guard, and integration with Prisma models (`PilotType`, `ProgramType`, `RankingPeriod`).

## Key methods

| Method | Description |
|--------|-------------|
| `getLeaderboard` | Paginated leaderboard with pilot context; prevents deep recursion. |
| Additional methods | Program enrollment, video submission, admin-facing updates — file is large (~1200 lines). |

## Dependencies

`PrismaService`, `AzureService`, `ConfigService`.
