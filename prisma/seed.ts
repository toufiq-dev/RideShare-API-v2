import {
  PrismaClient,
  VehicleTypeName,
  UserRole,
  VehicleTypeNameBD,
  VerificationStatus,
  UserStatus,
} from '@prisma/client';
import {
  CouponsNames,
  PilotCouponsNames,
} from '../src/modules/admin/admin.constants';
import { randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';

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
      serialNumber: 1,
      isFaster: true,
      airCondition: [],
      passengerCapacity: 1,
      baseFare: 42.0,
      perKmRate: 13.8,
      perMinRate: 0.28,
      minFare: 80.0,
      insuranceFee: 5.0,
    },
    {
      name: VehicleTypeNameBD.FAIR_PLUS,
      serialNumber: 2,
      isFaster: false,
      airCondition: [],
      passengerCapacity: 4,
      baseFare: 190.0,
      perKmRate: 30.0,
      perMinRate: 3.0,
      minFare: 350.0,
      insuranceFee: 20.0,
    },
    {
      name: VehicleTypeNameBD.FAIR_PRIME,
      serialNumber: 3,
      isFaster: false,
      airCondition: [],
      passengerCapacity: 4,
      baseFare: 120.0,
      perKmRate: 27.0,
      perMinRate: 2.0,
      minFare: 200.0,
      insuranceFee: 15.0,
    },

    {
      name: VehicleTypeNameBD.FAIR_MAX,
      serialNumber: 4,
      isFaster: false,
      airCondition: [],
      passengerCapacity: 6,
      baseFare: 250.0,
      perKmRate: 36.0,
      perMinRate: 3.0,
      minFare: 500.0,
      insuranceFee: 30.0,
    },
    {
      name: VehicleTypeNameBD.FAIR_CNG,
      serialNumber: 5,
      isFaster: false,
      airCondition: [],
      passengerCapacity: 3,
      baseFare: 100.0,
      perKmRate: 20.0,
      perMinRate: 1.0,
      minFare: 250.0,
      insuranceFee: 20.0,
    },
  ];

  const subscriptionTypes = [
    {
      name: 'Starter Pack',
      serialNumber: 2,
      coins: 22500,
      price: 715,
      priceBeforeDiscount: 750.0,
      quantifier: '10x',
      tag: 'Most Popular',
    },
    {
      name: 'Pro Pack',
      serialNumber: 3,
      coins: 67500,
      price: 2150,
      priceBeforeDiscount: 2250,
      quantifier: '30x',
      tag: 'Best Value',
    },
    {
      name: 'Mega Pack',
      serialNumber: 4,
      coins: 225000,
      price: 6490,
      priceBeforeDiscount: 7500,
      quantifier: '100x',
      tag: 'Super Saver',
    },
    {
      name: 'Flexi Pack',
      serialNumber: 1,
      coins: 2250,
      price: 75,
      priceBeforeDiscount: null,
      tag: 'Budget Friendly',
    },
  ];

  const coupons = [
    {
      name: CouponsNames.MINI,
      discount: 49,
      validUntil: new Date('2025-12-12'),
    },
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

  // Pilot Coupons
  const pilotCoupons = [
    {
      name: PilotCouponsNames.BONUS_AUTO_RECHARGE,
      description: 'Get 100% OFF',
      validUntil: new Date('2025-12-12'),
      subscriptionId: null,
    },
  ];
  for (const pilotCoupon of pilotCoupons) {
    const existingPilotCoupon = await prisma.pilotCoupon.findUnique({
      where: { name: pilotCoupon.name },
    });

    if (!existingPilotCoupon) {
      if (pilotCoupon.name === PilotCouponsNames.BONUS_AUTO_RECHARGE) {
        const subscription = await prisma.subscription.findUnique({
          where: { name: 'Flexi Pack' },
        });
        pilotCoupon.subscriptionId = subscription.id;
      }

      await prisma.pilotCoupon.create({
        data: pilotCoupon,
      });
      console.log(`Created pilot coupon: ${pilotCoupon.name}`);
    } else {
      console.log(`Pilot coupon ${pilotCoupon.name} already exists`);
    }
  }

  const users = [
    { role: UserRole.PILOT },
    { role: UserRole.PILOT },
    { role: UserRole.PILOT },
    { role: UserRole.PILOT },
    { role: UserRole.PILOT },
    { role: UserRole.PILOT },
    { role: UserRole.PILOT },
  ];

  const pilots = [
    { phone: '+8801412345673' },
    { phone: '+8801412345674' },
    { phone: '+8801412345675' },
    { phone: '+919999999999' },
    { phone: '+8801412345670' },
    { phone: '+8801412345671' },
    { phone: '+8801412345672' },
  ];

  const english = await prisma.languages.findUnique({
    where: { name: 'English' },
  });

  // Ensure the number of users and pilots match
  if (users.length !== pilots.length) {
    throw new Error('The number of users and pilots must match for seeding.');
  }

  const randromNumber = randomInt(0, vehicleTypeIds.length - 1);

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
        isTaxTokenVerified: VerificationStatus.APPROVED,
        isFairCoinAvailed: true,
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
        isFairCoinAvailed: true,
      },
    });

    console.log(`Created pilot with phone ${pilot.phone}`);
  }

  const customers = [
    { phone: '+8801412345673' },
    { phone: '+8801412345674' },
    { phone: '+919999999999' },
    { phone: '+8801412345670' },
    { phone: '+8801412345671' },
    { phone: '+8801412345672' },
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
      });

      const coupon = await prisma.coupon.findUnique({
        where: { name: 'Mini' },
      });

      await prisma.customer.create({
        data: {
          phone: customer.phone,
          languageId: english.id,
          userId: user.id,
          couponId: coupon.id,
        },
      });
      console.log(`Created customer with phone ${customer.phone}`);
    } else {
      console.log(`Customer with phone ${customer.phone} already exists`);
    }
  }

  // System Config
  await prisma.systemConfig.upsert({
    where: { key: 'bonusRechargeThreshold' },
    update: {},
    create: {
      key: 'bonusRechargeThreshold',
      value: { amount: 300 },
      description:
        'Low balance threshold to trigger bonus recharge eligibility.',
    },
  });

  const vehicleRegistrationPoints = [
    {
      code: 'BH',
      name: 'Bagerhat',
      category: 'District',
    },
    {
      code: 'DHK METRO',
      name: 'Dhaka Metro',
      category: 'Metropolitan',
    },
    {
      code: 'CTG METRO',
      name: 'Chittagong Metro',
      category: 'Metropolitan',
    },
    {
      code: 'SYL METRO',
      name: 'Sylhet Metro',
      category: 'Metropolitan',
    },
    {
      code: 'KHL Metro',
      name: 'Khulna Metro',
      category: 'Metropolitan',
    },
    {
      code: 'BN',
      name: 'Barguna',
      category: 'District',
    },
    {
      code: 'BR',
      name: 'Barisal',
      category: 'District',
    },
    {
      code: 'BA',
      name: 'Bhola',
      category: 'District',
    },
    {
      code: 'BO',
      name: 'Bogra',
      category: 'District',
    },
    {
      code: 'BB',
      name: 'Bandarban',
      category: 'District',
    },
    {
      code: 'CH',
      name: 'Chandpur',
      category: 'District',
    },
    {
      code: 'CN',
      name: 'Chapainawabganj',
      category: 'District',
    },
    {
      code: 'CD',
      name: 'Chuadanga',
      category: 'District',
    },
    {
      code: 'CM',
      name: 'Comilla',
      category: 'District',
    },
    {
      code: 'CB',
      name: "Cox's Bazar",
      category: 'District',
    },
    {
      code: 'DH',
      name: 'Dhaka',
      category: 'District',
    },
    {
      code: 'DP',
      name: 'Dinajpur',
      category: 'District',
    },
    {
      code: 'FP',
      name: 'Feni',
      category: 'District',
    },
    {
      code: 'FN',
      name: 'Faridpur',
      category: 'District',
    },
    {
      code: 'GB',
      name: 'Gaibandha',
      category: 'District',
    },
    {
      code: 'GP',
      name: 'Gazipur',
      category: 'District',
    },
    {
      code: 'GO',
      name: 'Gopalganj',
      category: 'District',
    },
    {
      code: 'HB',
      name: 'Habiganj',
      category: 'District',
    },
    {
      code: 'JM',
      name: 'Jamalpur',
      category: 'District',
    },
    {
      code: 'JS',
      name: 'Jessore',
      category: 'District',
    },
    {
      code: 'JK',
      name: 'Jhenaidah',
      category: 'District',
    },
    {
      code: 'JD',
      name: 'Joypurhat',
      category: 'District',
    },
    {
      code: 'JP',
      name: 'Jhalokati',
      category: 'District',
    },
    {
      code: 'KG',
      name: 'Kishoreganj',
      category: 'District',
    },
    {
      code: 'KH',
      name: 'Khulna',
      category: 'District',
    },
    {
      code: 'KS',
      name: 'Kushtia',
      category: 'District',
    },
    {
      code: 'KT',
      name: 'Kurigram',
      category: 'District',
    },
    {
      code: 'LP',
      name: 'Lakshmipur',
      category: 'District',
    },
    {
      code: 'LH',
      name: 'Lalmonirhat',
      category: 'District',
    },
    {
      code: 'MP',
      name: 'Madaripur',
      category: 'District',
    },
    {
      code: 'MG',
      name: 'Magura',
      category: 'District',
    },
    {
      code: 'MN',
      name: 'Manikganj',
      category: 'District',
    },
    {
      code: 'MH',
      name: 'Mymensingh',
      category: 'District',
    },
    {
      code: 'MB',
      name: 'Munshiganj',
      category: 'District',
    },
    {
      code: 'MS',
      name: 'Meherpur',
      category: 'District',
    },
    {
      code: 'MY',
      name: 'Moulvibazar',
      category: 'District',
    },
    {
      code: 'NG',
      name: 'Narayanganj',
      category: 'District',
    },
    {
      code: 'NR',
      name: 'Narsingdi',
      category: 'District',
    },
    {
      code: 'NA',
      name: 'Narail',
      category: 'District',
    },
    {
      code: 'ND',
      name: 'Netrokona',
      category: 'District',
    },
    {
      code: 'NT',
      name: 'Natore',
      category: 'District',
    },
    {
      code: 'NK',
      name: 'Naogaon',
      category: 'District',
    },
    {
      code: 'NL',
      name: 'Nilphamari',
      category: 'District',
    },
    {
      code: 'NO',
      name: 'Noakhali',
      category: 'District',
    },
    {
      code: 'PB',
      name: 'Pabna',
      category: 'District',
    },
    {
      code: 'PA',
      name: 'Patuakhali',
      category: 'District',
    },
    {
      code: 'PT',
      name: 'Pirojpur',
      category: 'District',
    },
    {
      code: 'PJ',
      name: 'Panchagarh',
      category: 'District',
    },
    {
      code: 'RB',
      name: 'Rajbari',
      category: 'District',
    },
    {
      code: 'RAJ METRO',
      name: 'Rajshahi Metropolitan',
      category: 'Metropolitan',
    },
    {
      code: 'RM',
      name: 'Rajshahi',
      category: 'District',
    },
    {
      code: 'RP',
      name: 'Rangpur',
      category: 'District',
    },
    {
      code: 'SK',
      name: 'Satkhira',
      category: 'District',
    },
    {
      code: 'SP',
      name: 'Sirajganj',
      category: 'District',
    },
    {
      code: 'SH',
      name: 'Sunamganj',
      category: 'District',
    },
    {
      code: 'SG',
      name: 'Shariatpur',
      category: 'District',
    },
    {
      code: 'SU',
      name: 'Sylhet',
      category: 'District',
    },
    {
      code: 'TG',
      name: 'Tangail',
      category: 'District',
    },
    {
      code: 'Tk',
      name: 'Thakurgaon',
      category: 'District',
    },
  ];

  const vehicleSeries = {
    bike: [
      {
        code: 'হ',
        english: 'HA',
        type: 'Motorcycle (80-125cc)',
        category: 'Motorcycle',
      },
      {
        code: 'ল',
        english: 'LA',
        type: 'Motorcycle (135-200cc)',
        category: 'Motorcycle',
      },
    ],
    car: [
      {
        code: 'ক',
        english: 'KA',
        type: 'Private Car (800cc)',
        category: 'Private Car',
      },
      {
        code: 'খ',
        english: 'KHA',
        type: 'Private Car (1000-1300cc)',
        category: 'Private Car',
      },
      {
        code: 'গ',
        english: 'GA',
        type: 'Private Car (1500-1800cc)',
        category: 'Private Car',
      },
      {
        code: 'ভ',
        english: 'BHA',
        type: 'Private Car (2000+cc)',
        category: 'Private Car',
      },
      {
        code: 'চ',
        english: 'CHA',
        type: 'Microbus',
        category: 'Commercial',
      },
      {
        code: 'ছ',
        english: 'CHHA',
        type: 'Rented Microbus',
        category: 'Commercial',
      },
      {
        code: 'প',
        english: 'PA',
        type: 'Taxi',
        category: 'Commercial',
      },
      {
        code: 'ম',
        english: 'MA',
        type: 'Commercial Pick-up',
        category: 'Commercial',
      },
      {
        code: 'ঘ',
        english: 'GHA',
        type: 'Jeep',
        category: 'Jeep',
      },
    ],
    cng: [
      {
        code: 'ধ',
        english: 'DHA',
        type: 'Private CNG',
        category: 'CNG',
      },
      {
        code: 'থ',
        english: 'THA',
        type: 'Rented CNG',
        category: 'CNG',
      },
    ],
  };

  // Vehicle Registration Point
  await prisma.systemConfig.upsert({
    where: { key: 'vehicleRegistrationPoints' },
    update: {},
    create: {
      key: 'vehicleRegistrationPoints',
      value: vehicleRegistrationPoints,
      description: 'Vehicle registration point',
    },
  });

  // Vehicle series
  await prisma.systemConfig.upsert({
    where: { key: 'vehicleSeries' },
    update: {},
    create: {
      key: 'vehicleSeries',
      value: vehicleSeries,
      description: 'Vehicle series',
    },
  });

  

  // Super Admin creation
  const superAdminEmail = 'safayetdib@gmail.com';
  const superAdminPassword = 'admin@2025';
  const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

  const existingUser = await prisma.user.findUnique({
    where: {
      email: superAdminEmail,
    },
  });
  let superAdminUser = existingUser;

  if (!existingUser) {
    superAdminUser = await prisma.user.create({
      data: {
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        email: superAdminEmail,
      },
    });
  }

  const existingSuperAdmin = await prisma.superAdmin.findUnique({
    where: {
      userId: superAdminUser.id,
    },
  });

  if (!existingSuperAdmin) {
    await prisma.superAdmin.create({
      data: {
        name: 'Super Admin',
        userId: superAdminUser?.id,
        password: hashedPassword,
      },
    });
    console.log('Super admin created successfully');
  } else {
    console.log('Super admin already exists');
  }


  // Menu permissions
  const menuPermissions = [
    "View Driver",
    "View Rides",
    "Manage Drivers",
    "Manage Rides",
    "Manage Settings",
  ];

  for (const menuPermission of menuPermissions) {

    const existingMenuPermission = await prisma.supportPermission.findUnique({
      where: { menuKey: menuPermission },
    });

    if (!existingMenuPermission) {
      await prisma.supportPermission.create({
        data: { menuKey: menuPermission },
      });
      console.log(`Created menu permission: ${menuPermission}`);
    } else {
      console.log(`Menu permission ${menuPermission} already exists`);
    }
  }

  console.log('Seeding Bangladeshi vehicle registration data finished.');
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
