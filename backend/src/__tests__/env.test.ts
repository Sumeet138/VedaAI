describe('env config', () => {
  it('parses valid env without throwing', () => {
    // setup.ts already sets all required vars
    expect(() => require('../config/env')).not.toThrow();
  });

  it('has correct PORT type as number', () => {
    const { env } = require('../config/env');
    expect(typeof env.PORT).toBe('number');
    expect(env.PORT).toBe(4001);
  });

  it('has correct WORKER_CONCURRENCY as number', () => {
    const { env } = require('../config/env');
    expect(typeof env.WORKER_CONCURRENCY).toBe('number');
  });

  it('throws when required var missing', () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    jest.resetModules(); // force re-require
    expect(() => require('../config/env')).toThrow();

    process.env.GEMINI_API_KEY = original;
    jest.resetModules();
  });
});
