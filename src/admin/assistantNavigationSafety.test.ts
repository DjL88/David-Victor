import { describe, expect, it } from 'vitest';
import {
  isSafeAdminAssistantNavigation,
  isSafeAdminAssistantSection,
  isSafeAdminAssistantTarget,
} from './assistantNavigationSafety';

describe('Altie navigation boundary', () => {
  it('allows only registered Admin sections', () => {
    expect(isSafeAdminAssistantSection('branding')).toBe(true);
    expect(isSafeAdminAssistantSection('product_rules')).toBe(true);
    expect(isSafeAdminAssistantSection('secrets')).toBe(false);
    expect(isSafeAdminAssistantSection('../branding')).toBe(false);
  });

  it('allows literal target identifiers but rejects selector injection', () => {
    expect(isSafeAdminAssistantTarget('branding-primary-colour')).toBe(true);
    expect(isSafeAdminAssistantTarget('language-copy-header.basket')).toBe(true);
    expect(isSafeAdminAssistantTarget('odd"] [data-other="target')).toBe(false);
    expect(isSafeAdminAssistantTarget('')).toBe(false);
  });

  it('fails closed when either the section or target is unsafe', () => {
    expect(isSafeAdminAssistantNavigation('branding', 'branding-save')).toBe(true);
    expect(isSafeAdminAssistantNavigation('unknown', 'branding-save')).toBe(false);
    expect(isSafeAdminAssistantNavigation('branding', '[onclick]')).toBe(false);
  });
});
