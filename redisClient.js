// backend/redisClient.js
const redis = require('redis');

// When running with Docker Compose, the hostname 'redis' will resolve to the Redis container.
// We use environment variables for flexibility, with defaults for local non-Docker setup.
const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;

console.log(`Attempting to connect to Redis at: redis://${redisHost}:${redisPort}`);

const client = redis.createClient({
  url: `redis://${redisHost}:${redisPort}`
});

client.on('error', (err) => console.error('Redis Client Error:', err));
client.on('connect', () => console.log('Connecting to Redis...')); // Emitted when the connection is initiated.
client.on('ready', () => console.log('Successfully connected to Redis and ready to use.')); // Emitted when Redis is ready for commands.
client.on('end', () => console.log('Disconnected from Redis.'));


async function connectRedis() {
  if (!client.isOpen && !client.isConnecting) { // Check if not already open or in the process of connecting
    try {
      await client.connect();
      // 'ready' event will confirm successful connection, no need to log here explicitly
    } catch (err) {
      console.error('Failed to connect to Redis during initial connect call:', err);
      // You might want to implement retry logic or graceful shutdown here
    }
  }
}

// Initiate the connection attempt when the module is loaded.
// The actual connection readiness is confirmed by the 'ready' event.
connectRedis();

module.exports = client;