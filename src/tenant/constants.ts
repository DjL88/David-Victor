/**
 * Shared default tenant identifier, imported by both server (BFF) and client code.
 * Single source of truth so the fallback tenant slug isn't repeated as a magic
 * string across adapter factories, admin screens, and mock data.
 */
export const DEFAULT_TENANT_ID = 'brand-alpha';
