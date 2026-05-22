import { redisConnection } from '../config/redis';

export const cacheService = {
  async get<T>(key: string): Promise<T | null> {
    const val = await redisConnection.get(key);
    return val ? (JSON.parse(val) as T) : null;
  },

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await redisConnection.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  },

  async del(key: string): Promise<void> {
    await redisConnection.del(key);
  },

  async setBuffer(key: string, buffer: Buffer, ttlSeconds: number): Promise<void> {
    await redisConnection.set(key, buffer, 'EX', ttlSeconds);
  },

  async getBuffer(key: string): Promise<Buffer | null> {
    return redisConnection.getBuffer(key);
  },

  async exists(key: string): Promise<boolean> {
    const v = await redisConnection.exists(key);
    return v === 1;
  },
};
