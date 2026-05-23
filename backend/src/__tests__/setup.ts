// Load test env vars before any test runs
process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.MONGODB_URI = 'mongodb://localhost:27017/vedaai_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.GEMINI_API_KEY = 'test-key-placeholder';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.WORKER_CONCURRENCY = '1';
process.env.MAX_FILE_SIZE_MB = '10';
