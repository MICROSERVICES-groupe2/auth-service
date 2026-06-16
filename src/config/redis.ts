import Redis from 'ioredis';
import { config } from './index';

export const redis = new Redis(config.redis.url, {
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 100, 3000);
    console.log(`🔄 Redis reconnexion dans ${delay}ms...`);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => console.log('✅ Redis connecté'));
redis.on('error', (err) => console.error('❌ Erreur Redis :', err));

export const redisSet = async (key: string, value: string, ttlSeconds?: number): Promise<void> => {
  if (ttlSeconds) {
    await redis.set(key, value, 'EX', ttlSeconds);
  } else {
    await redis.set(key, value);
  }
};

export const redisGet = async (key: string): Promise<string | null> => {
  return redis.get(key);
};

export const redisDel = async (key: string): Promise<void> => {
  await redis.del(key);
};