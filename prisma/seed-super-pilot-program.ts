import { PrismaClient, ProgramType } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSuperPilotProgram() {
  try {
    console.log('Starting Super Pilot Program seeding...');

    // 1. Create Super Pilot Program
    const superPilotProgram = await prisma.pilotProgram.upsert({
      where: { name: 'Super Pilot Program' },
      update: {
        criteria: { minEarnings: 10000, maxSuperPilots: 1000 },
        isActive: true,
      },
      create: {
        name: 'Super Pilot Program',
        description: 'Earn 10,000+ to become a Super Pilot and get FairCoin exemption',
        programType: ProgramType.SUPER_PILOT,
        isActive: true,
        criteria: { minEarnings: 10000, maxSuperPilots: 1000 },
        rewardType: 'FairCoinExemption',
        rewardValue: 'true',
        startDate: new Date(),
        endDate: null, // No end date
      },
    });

    console.log('Super Pilot Program created/updated:', superPilotProgram.id);

    // 2. Get all existing pilots
    const pilots = await prisma.pilot.findMany({
      select: {
        id: true,
        name: true,
        totalLifetimeEarnings: true,
        pilotType: true,
      },
    });

    console.log(`📊 Found ${pilots.length} pilots to process`);

    // 3. Create enrollments for all pilots
    const enrollments = [];
    for (const pilot of pilots) {
      try {
        const enrollment = await prisma.pilotProgramEnrollment.upsert({
          where: {
            pilotId_programId: {
              pilotId: pilot.id,
              programId: superPilotProgram.id,
            },
          },
          update: {
            // Update existing enrollment
            isCurrentlyActive: pilot.pilotType === 'SUPER_PILOT',
            achievedAt: pilot.pilotType === 'SUPER_PILOT' ? new Date() : null,
          },
          create: {
            pilotId: pilot.id,
            programId: superPilotProgram.id,
            enrolledAt: new Date(),
            isCurrentlyActive: pilot.pilotType === 'SUPER_PILOT',
            achievedAt: pilot.pilotType === 'SUPER_PILOT' ? new Date() : null,
          },
        });

        enrollments.push(enrollment);
        
        if (pilot.pilotType === 'SUPER_PILOT') {
          console.log(`${pilot.name} - Already Super Pilot (enrollment activated)`);
        } else if (Number(pilot.totalLifetimeEarnings) >= 10000) {
          console.log(`${pilot.name} - Eligible for Super Pilot (${pilot.totalLifetimeEarnings} earnings)`);
        } else {
          console.log(`${pilot.name} - Enrolled, needs ${10000 - Number(pilot.totalLifetimeEarnings)} more earnings`);
        }
      } catch (error) {
        console.error(`Error processing pilot ${pilot.name}:`, error);
      }
    }

    console.log(`Created/updated ${enrollments.length} pilot enrollments`);

    // 4. Summary
    const eligiblePilots = pilots.filter(p => 
      p.pilotType !== 'SUPER_PILOT' && Number(p.totalLifetimeEarnings) >= 10000
    );
    
    console.log('\nSUMMARY:');
    console.log(`- Total pilots: ${pilots.length}`);
    console.log(`- Already Super Pilots: ${pilots.filter(p => p.pilotType === 'SUPER_PILOT').length}`);
    console.log(`- Eligible for promotion: ${eligiblePilots.length}`);
    console.log(`- Need more earnings: ${pilots.length - eligiblePilots.length - pilots.filter(p => p.pilotType === 'SUPER_PILOT').length}`);

    if (eligiblePilots.length > 0) {
      console.log('\nPilots eligible for Super Pilot promotion:');
      eligiblePilots.forEach(pilot => {
        console.log(`  - ${pilot.name}: ${pilot.totalLifetimeEarnings} earnings`);
      });
    }

  } catch (error) {
    console.error('Error seeding Super Pilot Program:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedSuperPilotProgram()
  .then(() => {
    console.log('Super Pilot Program seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });