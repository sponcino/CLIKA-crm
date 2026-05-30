import Redis from 'ioredis';

const createRedisClient = () => new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const createBullMQConnection = () => new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

declare global {
  // eslint-disable-next-line no-var
  var redisGlobal: undefined | Redis;
  // eslint-disable-next-line no-var
  var bullmqGlobal: undefined | Redis;
}

const redis = globalThis.redisGlobal ?? createRedisClient();
const bullmqConnection = globalThis.bullmqGlobal ?? createBullMQConnection();

if (process.env.NODE_ENV !== 'production') {
  globalThis.redisGlobal = redis;
  globalThis.bullmqGlobal = bullmqConnection;
}

export default redis;
export { bullmqConnection };
