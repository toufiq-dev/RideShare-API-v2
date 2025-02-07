export default () => ({
  app: {
    port:
      process.env.NODE_ENV === 'development'
        ? parseInt(process.env['development.PORT'], 10) || 8080
        : parseInt(process.env.PORT, 10) || 3000,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    refreshTokenTTL: process.env.REFRESH_TOKEN_TTL || 60 * 60 * 24 * 7,
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SID,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
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
    rcToName: process.env.SIGNZY_RC_TO_NAME,
    rcToNamePreproduction: process.env.SIGNZY_RC_TO_NAME_PRE,
    rcVerifyBasic: process.env.SIGNZY_RC_VERIFY_BASIC,
  },
  subscription: {
    onboardingOffer: process.env.ONBOARDING_OFFER,
  },
});
