import { lookup } from 'dns/promises';
import { BadRequestException } from '@nestjs/common';

// Shared by every feature that fetches a URL a user supplied (recipe import,
// a dealer's pasted product image link, …) — one guard rather than each
// caller inventing its own.

/** True for a loopback/private/link-local address — blocks a server-side
    fetch of a user-supplied URL from reaching internal network services
    (SSRF). Not a complete defence (doesn't close a DNS-rebinding gap between
    this check and the actual fetch) — good enough alongside a short timeout
    and a strict check on what the response actually looks like. */
export function isPrivateAddress(ip: string): boolean {
  if (ip === '::1' || ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) {
    return true; // IPv6 loopback / unique local
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * Validates `url` is an http(s) link that doesn't resolve to a private/
 * loopback address, throwing `BadRequestException(unreachableMessage)`
 * otherwise. Returns the parsed URL for the caller to fetch.
 */
export async function assertPublicHttpUrl(url: string, unreachableMessage: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException(unreachableMessage);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException(unreachableMessage);
  }
  if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) {
    throw new BadRequestException(unreachableMessage);
  }
  try {
    const { address } = await lookup(parsed.hostname);
    if (isPrivateAddress(address)) {
      throw new BadRequestException(unreachableMessage);
    }
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException(unreachableMessage);
  }
  return parsed;
}
