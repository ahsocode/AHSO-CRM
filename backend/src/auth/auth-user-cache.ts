import { JwtUser } from "./auth.types";

interface CacheEntry {
  expiresAt: number;
  user: JwtUser | null; // null = user missing or inactive
}

const TTL_MS = 60_000;
const MAX_ENTRIES = 1000;
const PRUNE_ENTRIES = 200;

/**
 * Per-user auth context cache (60s TTL).
 *
 * JwtStrategy hydrates request.user from the DB on every request so that
 * deactivating a user or changing role permissions takes effect within 60s
 * instead of waiting for the access token to expire. This static cache keeps
 * that overhead to at most one DB query per user per minute.
 *
 * Static (no DI) by design — mirrors the PermissionsGuard cache pattern and
 * lets UsersService/RolesService invalidate without module wiring.
 */
export class AuthUserCache {
  private static readonly cache = new Map<string, CacheEntry>();

  static get(userId: string): CacheEntry | undefined {
    const entry = AuthUserCache.cache.get(userId);
    if (!entry || entry.expiresAt <= Date.now()) {
      return undefined;
    }
    return entry;
  }

  static set(userId: string, user: JwtUser | null): void {
    AuthUserCache.cache.set(userId, {
      user,
      expiresAt: Date.now() + TTL_MS
    });
    AuthUserCache.pruneIfNeeded();
  }

  /** Call when a single user's role/isActive changes. */
  static invalidate(userId: string): void {
    AuthUserCache.cache.delete(userId);
  }

  /** Call when role permissions change (role→user mapping unknown cheaply). */
  static invalidateAll(): void {
    AuthUserCache.cache.clear();
  }

  private static pruneIfNeeded(): void {
    if (AuthUserCache.cache.size <= MAX_ENTRIES) {
      return;
    }
    const keys = AuthUserCache.cache.keys();
    for (let index = 0; index < PRUNE_ENTRIES; index += 1) {
      const next = keys.next();
      if (next.done) {
        break;
      }
      AuthUserCache.cache.delete(next.value);
    }
  }
}
