import mongoose from 'mongoose';
import { env } from './env';

export async function connectMongo(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI, { dbName: 'vedaai' });
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
