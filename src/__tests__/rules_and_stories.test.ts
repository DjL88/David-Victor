import { describe, it, expect, beforeEach } from 'vitest';
import { MockAdminClient } from '../commerce/MockAdminClient';
import { MockCommerceClient } from '../commerce/MockCommerceClient';
import { ALL_MOCK_ADMIN_USERS } from '../commerce/mockData';
import { Story } from '../commerce/models';

describe('Rule Configuration and Story Filtering', () => {
  let adminClient: MockAdminClient;
  let commerceClient: MockCommerceClient;
  const marcusAlphaAdmin = ALL_MOCK_ADMIN_USERS.find((u) => u.id === 'usr-alpha-owner')!;

  beforeEach(() => {
    adminClient = new MockAdminClient();
    commerceClient = new MockCommerceClient('brand-alpha');
  });

  it('filters stories based on selected store targeting', async () => {
    // Add a story targeted exclusively to Chelmsford Central
    const targetedStory: Story = {
      id: 'story-chelmsford-only',
      title: 'Chelmsford Central Exclusive',
      author: 'Chef Leo',
      avatarUrl: 'https://example.com/avatar.jpg',
      eligibleStoreIds: ['store-chelmsford-central'],
      items: [
        {
          id: 'item-1',
          mediaUrl: 'https://example.com/media.jpg',
          mediaType: 'image',
          caption: 'Special drop',
          duration: 5,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    await adminClient.saveStory('brand-alpha', targetedStory, marcusAlphaAdmin);

    // When querying for Chelmsford Central, it should be included
    const chelmsfordStories = await commerceClient.getStories('store-chelmsford-central');
    expect(chelmsfordStories.some((s) => s.id === 'story-chelmsford-only')).toBe(true);

    // When querying for Billericay West, targeted story should NOT be included
    const billericayStories = await commerceClient.getStories('store-billericay-west');
    expect(billericayStories.some((s) => s.id === 'story-chelmsford-only')).toBe(false);
  });

  it('allows managing declarative product rules and persists priority ordering', async () => {
    const rules = await adminClient.getProductRules('brand-alpha');
    expect(rules.length).toBeGreaterThan(0);

    // Add new declarative rule
    const newRule = {
      id: 'rule-high-caffeine',
      name: 'Energy Drink 16+ Age Gate',
      enabled: true,
      countries: ['GB'],
      priority: 80,
      matchConditions: [
        { field: 'productTag' as const, operator: 'equals' as const, value: 'HIGH_CAFFEINE' },
      ],
      actions: [
        { type: 'MINIMUM_AGE' as const, minimumAge: 16, params: { age: 16 } },
        { type: 'BADGE' as const, label: '16+ Only', params: { text: '16+ Only', color: 'orange' } },
      ],
    };

    const savedRules = await adminClient.saveProductRule('brand-alpha', newRule, marcusAlphaAdmin);
    const retrieved = savedRules.find((r) => r.id === 'rule-high-caffeine');
    expect(retrieved).toBeDefined();
    expect(retrieved?.priority).toBe(80);
    expect(retrieved?.actions[0].type).toBe('MINIMUM_AGE');
  });
});
