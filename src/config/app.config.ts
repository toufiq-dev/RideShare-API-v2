export default () => ({
  app: {
    port:
      process.env.NODE_ENV === 'development'
        ? parseInt(process.env.PORT, 10) || 3000
        : parseInt(process.env.PORT, 10) || 8080,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    accessTokenTTL: process.env.REDIS_ACCESS_TOKEN_TTL || 60 * 60 * 24 * 1,
    refreshTokenTTL: process.env.REDIS_REFRESH_TOKEN_TTL || 60 * 60 * 24 * 7,
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
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN,
    refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN,
  },
  azure: {
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    containerName: process.env.AZURE_STORAGE_CONTAINER_NAME,
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
  },
  file: {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
    maxFileSize: 3 * 1024 * 1024,
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
  pricing: {
    aPlus: 924, // a is the “height” of the initial per_km_fare above the flat rate,
    bPlus: 2.06, // b controls how quickly it drops as distance increases, Decay rate
    cPlus: 22.0, // c is the flat rate that per_km_fare approaches for long distances
  },
});
