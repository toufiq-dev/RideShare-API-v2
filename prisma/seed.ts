import { PrismaClient, VehicleTypeName, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const languages = [
    { name: 'English' },
    { name: 'Hindi' },
    { name: 'Marathi' },
    { name: 'Gujarati' },
    { name: 'Kannada' },
    { name: 'Telugu' },
    { name: 'Tamil' },
    { name: 'Malayalam' },
    { name: 'Punjabi' },
    { name: 'Bengali' },
    { name: 'Urdu' },
    { name: 'Assamese' },
    { name: 'Oriya' },
  ];

  const vehicleTypes = [
    {
      name: VehicleTypeName.HATCHBACK,
      isFaster: true,
      airCondition: ['AC'],
      passengerCapacity: 4,
      baseFare: 50.0,
      perKmRate: 15.0,
      perMinRate: 2.0,
    },
    {
      name: VehicleTypeName.SEDAN,
      isFaster: false,
      airCondition: ['AC'],
      passengerCapacity: 4,
      baseFare: 55.0,
      perKmRate: 15.0,
      perMinRate: 2.0,
    },
    {
      name: VehicleTypeName.SUV,
      isFaster: false,
      airCondition: ['AC'],
      passengerCapacity: 6,
      baseFare: 60.0,
      perKmRate: 15.0,
      perMinRate: 2.0,
    },
    {
      name: VehicleTypeName.KALIPEELI,
      isFaster: false,
      airCondition: ['AC', 'Non-AC'],
      passengerCapacity: 4,
      baseFare: 45.0,
      perKmRate: 15.0,
      perMinRate: 2.0,
    },
    {
      name: VehicleTypeName.AUTORICKSHAW,
      isFaster: false,
      airCondition: ['Non-AC'],
      passengerCapacity: 3,
      baseFare: 30.0,
      perKmRate: 10.0,
      perMinRate: 1.5,
    },
    {
      name: VehicleTypeName.OTHER,
      isFaster: false,
      airCondition: ['Non-AC'],
      passengerCapacity: 0,
      baseFare: 50.0,
      perKmRate: 15.0,
      perMinRate: 2.0,
    },
  ];

  const subscriptionTypes = [
    {
      name: 'Starter Pack',
      coins: 45000,
      price: 1390,
      priceBeforeDiscount: 1400.99,
      tag: 'Most Popular',
    },
    {
      name: 'Pro Pack',
      coins: 135000,
      price: 3990,
      priceBeforeDiscount: 4470,
      tag: 'Best Value',
    },
    {
      name: 'Mega Pack',
      coins: 450000,
      price: 12500,
      priceBeforeDiscount: 14900,
      tag: 'Super Saver',
    },
    {
      name: 'Flexi Pack',
      coins: 4500,
      price: 149,
      priceBeforeDiscount: null,
      tag: 'Budget Friendly',
    },
  ];

  const coupons = [
    { name: 'Chota', discount: 49, validUntil: new Date('2025-12-12') },
  ];

  const users = [
    {
      role: UserRole.PILOT,
    },
  ];

  const pilots = [
    {
      phone: '+911234567890',
    },
    {
      phone: '+911234567891',
    },
  ];

  for (const user of users) {
    const newUser = await prisma.user.create({
      data: {
        role: user.role,
      },
    });

    const english = await prisma.languages.findUnique({
      where: { name: 'English' },
    });

    for (const pilot of pilots) {
      const existingpilot = await prisma.pilot.findUnique({
        where: { phone: pilot.phone },
      })

      if (existingpilot) {
        continue;
      }

      const newPilot = await prisma.pilot.create({
        data: {
          phone: pilot.phone,
          userId: newUser.id,
          languageId: english.id,
          isDLVerified: true,
          isRCVerified: true,
        },
      });

      await prisma.drivingLicense.create({
        data: {
          licenseNumber: Date.now().toString(),
          nameOnLicense: 'Antor Saha',
          dateOfIssue: new Date(),
          validUntill: new Date(),
          dateOfBirth: new Date(),
          pilotId: newPilot.id,
        },
      });

      const vehicleType = await prisma.vehicleType.findUnique({
        where: { name: 'HATCHBACK' },
      });

      await prisma.vehicle.create({
        data: {
          regNo: '123456',
          regUpto: new Date(),
          permitUpto: new Date(),
          status: 'ACTIVE',
          insuranceUpto: new Date(),
          manufacturer: 'Honda',
          model: 'Civic',
          colour: 'Black',
          seatCapacity: '4',
          state: 'Maharashtra',
          pilotId: newPilot.id,
          vehicleTypeId: vehicleType.id,
        },
      });

      const subscription = await prisma.subscription.findUnique({
        where: { name: 'Starter Pack' },
      });

      await prisma.pilotWallet.create({
        data: {
          pilotId: newPilot.id,
          balance: 4800,
          subscriptionId: subscription.id,
        },
      });
    }
  }

  // for (const language of languages) {
  //   const existingLanguage = await prisma.languages.findUnique({
  //     where: { name: language.name },
  //   });

  //   if (!existingLanguage) {
  //     await prisma.languages.create({
  //       data: language,
  //     });
  //     console.log(`Created language: ${language.name}`);
  //   } else {
  //     console.log(`Language ${language.name} already exists`);
  //   }
  // }

  // for (const vehicleType of vehicleTypes) {
  //   const existingVehicleType = await prisma.vehicleType.findUnique({
  //     where: { name: vehicleType.name },
  //   });

  //   if (!existingVehicleType) {
  //     await prisma.vehicleType.create({
  //       data: vehicleType,
  //     });
  //     console.log(`Created vehicle type: ${vehicleType.name}`);
  //   } else {
  //     console.log(`Vehicle type ${vehicleType.name} already exists`);
  //   }
  // }

  // for (const subscription of subscriptionTypes) {
  //   const existingSubscription = await prisma.subscription.findUnique({
  //     where: { name: subscription.name },
  //   });

  //   if (!existingSubscription) {
  //     await prisma.subscription.create({
  //       data: subscription,
  //     });
  //     console.log(`Created subscription: ${subscription.name}`);
  //   } else {
  //     console.log(`Subscription ${subscription.name} already exists`);
  //   }
  // }

  // for (const coupon of coupons) {
  //   const existingCoupon = await prisma.coupon.findUnique({
  //     where: { name: coupon.name },
  //   });

  //   if (!existingCoupon) {
  //     await prisma.coupon.create({
  //       data: coupon,
  //     });
  //     console.log(`Created coupon: ${coupon.name}`);
  //   } else {
  //     console.log(`Coupon ${coupon.name} already exists`);
  //   }
  // }

  console.log('Seeding vehicle types finished.');
  console.log('Seeding languages and vehicle types finished.');
  console.log('Seeding subscription types finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
