import { isIP } from 'node:net';

const isPrivateIPv4 = (ip: string): boolean => {
  const [a, b, c] = ip.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return a >= 224;
};

const isPrivateIPv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isPrivateIPv4(v4Mapped[1]);
  // URL.hostname normalizes v4-mapped addresses to hex groups (::ffff:a00:1)
  const v4MappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (v4MappedHex) {
    const high = Number.parseInt(v4MappedHex[1], 16);
    const low = Number.parseInt(v4MappedHex[2], 16);
    return isPrivateIPv4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }
  return /^(f[cd]|fe[89ab]|ff)/.test(normalized);
};

// True for loopback, private, link-local, CGNAT, benchmarking, multicast and reserved
// ranges (IPv4 + IPv6, including v4-mapped forms). Non-IP strings return false.
export const isPrivateAddress = (ip: string): boolean => {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return false;
};
