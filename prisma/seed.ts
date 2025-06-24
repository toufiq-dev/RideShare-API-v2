import { PrismaClient, VehicleTypeName, UserRole, VehicleTypeNameBD, VerificationStatus } from '@prisma/client';
import { CouponsNames } from '../src/modules/admin/admin.constants';
import { randomInt } from 'node:crypto';

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

  const vehicleTypesBD = [
    {
      name: VehicleTypeNameBD.FAIR_BIKE,
      isFaster: true,
      airCondition: [],
      passengerCapacity: 1,
      baseFare: 42.0,
      perKmRate: 14.0,
      perMinRate: 0.50,
      minFare: 80.0,
      insuranceFee: 5.0,
    },
    {
      name: VehicleTypeNameBD.FAIR_PRIME,
      isFaster: false,
      airCondition: [],
      passengerCapacity: 4,
      baseFare: 120.0,
      perKmRate: 27.0,
      perMinRate: 2.00,
      minFare: 200.0,
      insuranceFee: 15.0,
    },
    {
      name: VehicleTypeNameBD.FAIR_PLUS,
      isFaster: false,
      airCondition: [],
      passengerCapacity: 4,
      baseFare: 190.0,
      perKmRate: 30.0,
      perMinRate: 3.00,
      minFare: 350.0,
      insuranceFee: 20.0,
    },
    {
      name: VehicleTypeNameBD.FAIR_MAX,
      isFaster: false,
      airCondition: [],
      passengerCapacity: 6,
      baseFare: 250.0,
      perKmRate: 36.0,
      perMinRate: 3.00,
      minFare: 500.0,
      insuranceFee: 30.0,
    },
    {
      name: VehicleTypeNameBD.FAIR_CNG,
      isFaster: false,
      airCondition: [],
      passengerCapacity: 3,
      baseFare: 100.0,
      perKmRate: 20.0,
      perMinRate: 1.00,
      minFare: 250.0,
      insuranceFee: 20.0,
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
    { name: CouponsNames.MINI, discount: 49, validUntil: new Date('2025-12-12') },
  ];

  

  for (const language of languages) {
    const existingLanguage = await prisma.languages.findUnique({
      where: { name: language.name },
    });

    if (!existingLanguage) {
      await prisma.languages.create({
        data: language,
      });
      console.log(`Created language: ${language.name}`);
    } else {
      console.log(`Language ${language.name} already exists`);
    }
  }


  const vehicleTypeIds = [];
  for (const vehicleType of vehicleTypesBD) {
    let vehicleTypeBD = await prisma.vehicleTypeBD.findUnique({
      where: { name: vehicleType.name },
    });

    if (!vehicleTypeBD) {
      vehicleTypeBD = await prisma.vehicleTypeBD.create({
        data: vehicleType,
      });
      console.log(`Created vehicle type: ${vehicleType.name}`);
    } else {
      console.log(`Vehicle type ${vehicleType.name} already exists`);
    }

    vehicleTypeIds.push(vehicleTypeBD.id);
  }

  for (const subscription of subscriptionTypes) {
    const existingSubscription = await prisma.subscription.findUnique({
      where: { name: subscription.name },
    });

    if (!existingSubscription) {
      await prisma.subscription.create({
        data: subscription,
      });
      console.log(`Created subscription: ${subscription.name}`);
    } else {
      console.log(`Subscription ${subscription.name} already exists`);
    }
  }

  for (const coupon of coupons) {
    const existingCoupon = await prisma.coupon.findUnique({
      where: { name: coupon.name },
    });

    if (!existingCoupon) {
      await prisma.coupon.create({
        data: coupon,
      });
      console.log(`Created coupon: ${coupon.name}`);
    } else {
      console.log(`Coupon ${coupon.name} already exists`);
    }
  }


  const users = [
    { role: UserRole.PILOT },
    { role: UserRole.PILOT },
    { role: UserRole.PILOT },
    { role: UserRole.PILOT}
  ];
  
  const pilots = [
    { phone: '+911234567890' },
    { phone: '+911234567891' },
    { phone: '+911234567892' },
    { phone: '+919999999999' },
  ];
  
  const english = await prisma.languages.findUnique({
    where: { name: 'English' },
  });
  
  // Ensure the number of users and pilots match
  if (users.length !== pilots.length) {
    throw new Error('The number of users and pilots must match for seeding.');
  }

  const randromNumber = randomInt(0, vehicleTypeIds.length - 1);
  console.log('randromNumber', randromNumber);
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const pilot = pilots[i];
  
    // Check if pilot already exists
    const existingPilot = await prisma.pilot.findUnique({
      where: { phone: pilot.phone },
    });
  
    if (existingPilot) {
      console.log(`Pilot with phone ${pilot.phone} already exists`);
      continue;
    }
  
    // Create a new User
    const newUser = await prisma.user.create({
      data: {
        role: user.role,
      },
    });
  
    // Create a new Pilot associated with the new User
    const newPilot = await prisma.pilot.create({
      data: {
        phone: pilot.phone,
        userId: newUser.id, // Unique userId for this pilot
        languageId: english.id,
        isDLVerified: VerificationStatus.APPROVED,
        isRCVerified: VerificationStatus.APPROVED,
        isNidVerified: VerificationStatus.APPROVED,
        isSelfieVerified: VerificationStatus.APPROVED,
        isNumberPlateVerified: VerificationStatus.APPROVED,
        isFairCoinAvailed: true
      },
    });
  
    // Create DrivingLicense
    await prisma.drivingLicense.create({
      data: {
        licenseNumber: Date.now().toString() + i, // Ensure unique license number
        nameOnLicense: 'Antor Saha',
        dateOfIssue: new Date(),
        validUntill: new Date(),
        dateOfBirth: new Date(),
        pilotId: newPilot.id,
      },
    });
  
    // Fetch VehicleType
    const vehicleType = await prisma.vehicleTypeBD.findUnique({
      where: { name: VehicleTypeNameBD.FAIR_BIKE },
    });
  
    // Create Vehicle
    const regNo = Date.now().toString() + i; // Ensure unique regNo
    await prisma.vehicle.create({
      data: {
        regNo,
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
        vehicleTypeIdBD: vehicleTypeIds[randromNumber],
      },
    });
  
    // Fetch Subscription
    const subscription = await prisma.subscription.findUnique({
      where: { name: 'Starter Pack' },
    });
  
    // Create PilotWallet
    await prisma.pilotWallet.create({
      data: {
        pilotId: newPilot.id,
        balance: 4800,
        subscriptionId: subscription.id,
      },
    });

    await prisma.pilot.update({
      where: { id: newPilot.id },
      data: {
        isFairCoinAvailed: true
      },
    })
  
    console.log(`Created pilot with phone ${pilot.phone}`);
  }

  const customers = [
    { phone: '+911234567892' },
    { phone: '+911234567893' },
    { phone: '+919999999999' },
  ];
  
  for (const customer of customers) {
    const existingCustomer = await prisma.customer.findUnique({
      where: { phone: customer.phone },
    });
  
    if (!existingCustomer) {
      const user = await prisma.user.create({
        data: {
          role: UserRole.CUSTOMER,
        },
      })

      const coupon = await prisma.coupon.findUnique({
        where: { name: 'Mini' },
      })

      await prisma.customer.create({
        data: {
          phone: customer.phone,
          languageId: english.id,
          userId: user.id,
          couponId: coupon.id
        },
      });
      console.log(`Created customer with phone ${customer.phone}`);
    } else {
      console.log(`Customer with phone ${customer.phone} already exists`);
    }
  }

  await prisma.systemConfig.upsert({
    where: { key: 'bonusRechargeThreshold' },
    update: {},
    create: {
      key: 'bonusRechargeThreshold',
      value: { amount: 300 },
      description: 'Low balance threshold to trigger bonus recharge eligibility.',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'bonusRechargeAmount' },
    update: {},
    create: {
      key: 'bonusRechargeAmount',
      value: { amount: 2000 },
      description: 'The amount to be given as a bonus recharge.',
    },
  });

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
