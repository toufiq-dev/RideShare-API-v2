export default () => ({
  app: {
    port: parseInt(process.env.PORT, 10) || 3000,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  //   redis: {
  //     url: process.env.REDIS_URL || 'redis://localhost:6379',
  //   },
});
