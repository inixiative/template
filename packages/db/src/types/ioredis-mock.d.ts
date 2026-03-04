declare module 'ioredis-mock' {
  import type Redis from 'ioredis';
  const RedisMock: typeof Redis;
  export default RedisMock;
}
