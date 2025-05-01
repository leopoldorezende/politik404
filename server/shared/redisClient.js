const Redis = require('ioredis');
const redis = new Redis(); // localhost por padrão

module.exports = redis;