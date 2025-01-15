export default () => ({
  app: {
    port: parseInt(process.env.PORT, 10) || 3000,
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
});
