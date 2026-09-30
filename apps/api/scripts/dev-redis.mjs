const mod = await import('redis-memory-server');
const RedisMemoryServer = mod.default?.default ?? mod.default;
const rms = new RedisMemoryServer({ instance: { port: 6399, ip: '127.0.0.1' } });
const host = await rms.getHost();
const port = await rms.getPort();
console.log(`[dev-redis] ready on ${host}:${port}`);
process.on('SIGINT', async () => { await rms.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
