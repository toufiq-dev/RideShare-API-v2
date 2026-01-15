export default () => ({
  app: {
    port: parseInt(process.env.PORT, 10) || 3000,
    version: process.env.API_VERSION || 'v1',
    environment: process.env.NODE_ENV || 'production',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false',
    enableLoki: process.env.ENABLE_LOKI === 'true',
    lokiUrl: process.env.LOKI_URL || 'http://loki:3100',
  },
  redis: {
    url: process.env.REDIS_URL,
    accessTokenTTL: process.env.REDIS_ACCESS_TOKEN_TTL || 60 * 60 * 24 * 1,
    refreshTokenTTL: process.env.REDIS_REFRESH_TOKEN_TTL || 60 * 60 * 24 * 7,
  },
  pricing: {
    city: process.env.CITY || 'dhaka',
    MU_MIN: parseFloat(process.env.MU_MIN) || 0.8,
    MU_MAX: parseFloat(process.env.MU_MAX) || 1.23,
  },
  msg91: {
    baseUrl: process.env.MSG91_BASE_URL,
    authKey: process.env.MSG91_AUTH_KEY,
    templateId: process.env.MSG91_TEMPLATE_ID,
    senderId: process.env.MSG91_SENDER_ID,
  },
  khudebarta: {
    baseUrl: process.env.KHUDEBARTA_BASE_URL,
    apiKey: process.env.KHUDEBARTA_API_KEY,
    secretKey: process.env.KHUDEBARTA_SECRET_KEY,
    senderId: process.env.KHUDEBARTA_SENDER_ID,
  },
  ssl: {
    baseUrl:
      process.env.SSL_BASE_URL ||
      'https://smsplus.sslwireless.com/api/v3/send-sms',
    apiToken: process.env.SSL_API_TOKEN,
    senderId: process.env.SSL_SENDER_ID || 'FAIRDRIVE',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN,
    refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN,
  },
  azure: {
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    containerName: process.env.AZURE_STORAGE_CONTAINER_NAME,
    containerNameDb: process.env.AZURE_STORAGE_CONTAINER_DB,
    cognitiveServices: {
      endpoint: process.env.AZURE_COGNITIVE_SERVICES_ENDPOINT,
      apiKey: process.env.AZURE_COGNITIVE_SERVICES_API_KEY,
    },
    openai: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_KEY,
      model: process.env.AZURE_MODEL_NAME,
      apiVersion: process.env.AZURE_API_VERSION,
    },
    communication: {
      connectionString: process.env.AZURE_COMMUNICATION_CONNECTION_STRING,
      senderAddress: process.env.AZURE_COMMUNICATION_SENDER_ADDRESS,
    },
  },
  file: {
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/mov',
      'video/avi',
      'video/quicktime',
      'video/x-msvideo',
    ],
    maxFileSize: 3 * 1024 * 1024,
    maxVideoSize: 100 * 1024 * 1024,
    tempUploadDir: './uploads/temp',
  },
  signzy: {
    productionAccessToken: process.env.SIGNZY_ACCESS_TOKEN_PRODUCTION,
    preproductionAccessToken: process.env.SIGNZY_ACCESS_TOKEN_PREPRODUCTION,
    drivingLicenseEndPoint: process.env.SIGNZY_DL_ENDPOINT_PRODUCTION,
    drivingLicenseEndPointPreproduction: process.env.SIGNZY_DL_ENDPOINT_TESTING,
    panVerifyEndPoint: process.env.SIGNZY_PAN_VERIFY_ENDPOINT,
    panVerifyEndPointPreproduction:
      process.env.SIGNZY_PAN_VERIFY_ENDPOINT_TESTING,
    rcVerifyEndPoint: process.env.SIGNZY_RC_VERIFY_ENDPOINT,
    rcVerifyEndPointPreproduction: process.env.SIGNZY_RC_VERIFY_ENDPOINT_PRE,
    rcVerifyBasic: process.env.SIGNZY_RC_VERIFY_BASIC,
    getAadhaar: process.env.SIGNZY_GET_AADHAAR,
    getAadhaarPreproduction: process.env.SIGNZY_GET_AADHAAR_PRE,
  },
  cashfreeAadhaar: {
    sendOtpEndPoint: process.env.CASHFREE_GENERATE_OTP_ENDPOINT,
    verifyAadhaarEndPoint: process.env.CASHFREE_VERIFY_AADHAAR_ENDPOINT,
    clientId: process.env.CASHFREE_CLIENT_ID,
    clientSecret: process.env.CASHFREE_CLIENT_SECRET,
  },
  cashfreePayment: {
    createOrderURL: process.env.PAYMENT_CREATE_ORDER_URL,
    apiVersion: process.env.PAYMENT_API_VERSION,
    testClientId: process.env.PAYMENT_TEST_CLIENT_ID,
    testClientSecret: process.env.PAYMENT_TEST_CLIENT_SECRET,
  },
  subscription: {
    onboardingOffer: 'Onboarding Offer',
    starterPack: 'Starter Pack',
    proPack: 'Pro Pack',
    megaPack: 'Mega Pack',
    flexiPack: 'Flexi Pack',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  },
  systemConfig: {
    bonusRechargeThreshold: 'bonusRechargeThreshold',
  },
  // pricing: {
  //   aPlus: 924, // a is the “height” of the initial per_km_fare above the flat rate,
  //   bPlus: 2.06, // b controls how quickly it drops as distance increases, Decay rate
  //   cPlus: 22.0, // c is the flat rate that per_km_fare approaches for long distances
  // },
});
