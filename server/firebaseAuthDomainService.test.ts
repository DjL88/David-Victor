import { describe, expect, it } from 'vitest';
import {
  isAuthorizableFirebaseDomain,
  normalizeAuthorizedDomain,
} from './firebaseAuthDomainService';

describe('FirebaseAuthDomainService helpers', () => {
  it('normalizes hostnames before Firebase Auth configuration', () => {
    expect(normalizeAuthorizedDomain('https://Shop.Example.com/path')).toBe('shop.example.com');
    expect(normalizeAuthorizedDomain('preview.example.com:443')).toBe('preview.example.com');
  });

  it('accepts real hostnames and rejects local/invalid values', () => {
    expect(isAuthorizableFirebaseDomain('shop.example.com')).toBe(true);
    expect(isAuthorizableFirebaseDomain('ais-dev-example.europe-west3.run.app')).toBe(true);
    expect(isAuthorizableFirebaseDomain('localhost')).toBe(false);
    expect(isAuthorizableFirebaseDomain('127.0.0.1')).toBe(false);
    expect(isAuthorizableFirebaseDomain('not a hostname')).toBe(false);
  });
});
