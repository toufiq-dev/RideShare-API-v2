import { PrismaClient, VehicleTypeName } from '@prisma/client';

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
      baseFare: 50.00,
      perKmRate: 15.00,
      perMinRate: 2.00,
    },
    {
      name: VehicleTypeName.SEDAN,
      isFaster: false,
      airCondition: ['AC'],
      passengerCapacity: 4,
      baseFare: 55.00,
      perKmRate: 15.00,
      perMinRate: 2.00,
    },
    {
      name: VehicleTypeName.SUV,
      isFaster: false,
      airCondition: ['AC'],
      passengerCapacity: 6,
      baseFare: 60.00,
      perKmRate: 15.00,
      perMinRate: 2.00,
    },
    {
      name: VehicleTypeName.KALIPEELI,
      isFaster: false,
      airCondition: ['AC', 'Non-AC'],
      passengerCapacity: 4,
      baseFare: 45.00,
      perKmRate: 15.00,
      perMinRate: 2.00,
    },
    {
      name: VehicleTypeName.AUTORICKSHAW,
      isFaster: false,
      airCondition: ['Non-AC'],
      passengerCapacity: 3,
      baseFare: 30.00,
      perKmRate: 10.00,
      perMinRate: 1.50,
    },
    {
      name: VehicleTypeName.OTHER,
      isFaster: false,
      airCondition: ['Non-AC'],
      passengerCapacity: 0,
      baseFare: 50.00,
      perKmRate: 15.00,
      perMinRate: 2.00,
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

  const coupons = [{ name: 'Chota', discount: 49, validUntil: new Date('2025-12-12') }];

  const pilots = [
    {
      id: "8a76ab2f-dd6e-44bb-a348-1fa9a09f06fw",
      phone: "+911234567892",
      userId: "8a76ab2f-dd6e-44bb-a348-1fa9a09f06fq",
      languageId: "8a76ab2f-dd6e-44bb-a348-1fa9a09f06fd"
    }
  ]

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

  for (const vehicleType of vehicleTypes) {
    const existingVehicleType = await prisma.vehicleType.findUnique({
      where: { name: vehicleType.name, },
    });

    if (!existingVehicleType) {
      await prisma.vehicleType.create({
        data: vehicleType,
      });
      console.log(`Created vehicle type: ${vehicleType.name}`);
    } else {
      console.log(`Vehicle type ${vehicleType.name} already exists`);
    }
  }

  for (const vehicleType of vehicleTypes) {
    const existingVehicleType = await prisma.vehicleType.findUnique({
      where: { name: vehicleType.name },
    });

    if (!existingVehicleType) {
      await prisma.vehicleType.create({
        data: vehicleType,
      });
      console.log(`Created vehicle type: ${vehicleType.name}`);
    } else {
      console.log(`Vehicle type ${vehicleType.name} already exists`);
    }
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
