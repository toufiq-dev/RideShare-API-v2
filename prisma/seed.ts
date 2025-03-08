import { PrismaClient } from '@prisma/client';

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
    { name: 'Hatch back' },
    { name: 'Sedan' },
    { name: 'SUV' },
    { name: 'Kali Peeli' },
    { name: 'Auto-Rickshaw' },
    { name: 'Other' },
  ];

  const subscriptionTypes = [
    {
      name: 'Starter Pack',
      coins: 45000,
      price: 1390,
      priceBeforeDiscount: 1400,
      description: "Most Popular",
    },
    { name: 'Pro Pack', coins: 135000, price: 3990, priceBeforeDiscount: 4470, description: "Best Value" },
    {
      name: 'Mega Pack',
      coins: 450000,
      price: 12500,
      priceBeforeDiscount: 14900,
      description: 'Super Saver',
    },
    { name: 'Flexi Pack', coins: 4500, price: 149, priceBeforeDiscount: null, description: "Budget Friendly" },
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
