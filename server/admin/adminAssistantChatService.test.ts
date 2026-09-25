import { describe, expect, it } from 'vitest';
import {
  buildAdminAssistantSystemInstruction,
  buildDegradedAssistantReply,
  extractCatalogLookupQuery,
  getAdminAssistantSuggestions,
  normaliseAssistantReply,
  normaliseChatHistory,
  resolveAdminAssistantNavigationHint,
  resolveContextualCatalogLookupQuery,
} from './adminAssistantChatService';

describe('AdminAssistantChatService foundations', () => {
  it('builds a tenant-bound system instruction without granting direct write access', () => {
    const instruction = buildAdminAssistantSystemInstruction({
      tenantId: 'tenant-a',
      actorRole: 'tenantAdmin',
      actorName: 'Admin',
      context: {
        section: 'branding',
        locationId: 'location-1',
      },
    });

    expect(instruction).toContain('"tenantId":"tenant-a"');
    expect(instruction).toContain('"section":"branding"');
    expect(instruction).toContain('You do not have direct Firestore');
    expect(instruction).toContain('For writes, follow the control-plane chain');
    expect(instruction).toContain('preview → typed ChangeSet → permission/approval → execute through its typed adapter → audit');
    expect(instruction).toContain('Default to under 90 words');
    expect(instruction).toContain('Use plain text, not Markdown');
    expect(instruction).toContain('You are Altie');
    expect(instruction).toContain('Refer to yourself as Altie');
    expect(instruction).not.toContain('You are Artie');
    expect(instruction).not.toContain('GEMINI_API_KEY');
  });

  it('trims and bounds conversation history', () => {
    const history = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: ` message ${index} `,
    }));

    const result = normaliseChatHistory(history);
    expect(result).toHaveLength(12);
    expect(result[0].content).toBe('message 8');
    expect(result[11].content).toBe('message 19');
  });

  it('drops empty chat messages', () => {
    expect(normaliseChatHistory([
      { role: 'user', content: '   ' },
      { role: 'assistant', content: 'Useful reply' },
    ])).toEqual([
      { role: 'assistant', content: 'Useful reply' },
    ]);
  });

  it('cleans markdown-like formatting from assistant replies', () => {
    expect(normaliseAssistantReply('### Heading\n- **Useful** `catalog.inspect`')).toBe(
      'Heading\n• Useful catalog.inspect'
    );
  });

  it('returns short page-aware quick replies', () => {
    expect(getAdminAssistantSuggestions('hero_banners')).toEqual([
      'Help me create a banner',
      'Explain stock-linked banners',
      'What details do you need?',
    ]);
    expect(getAdminAssistantSuggestions('unknown')).toHaveLength(3);
  });

  it('maps natural Admin questions to page, field and safe draft guidance', () => {
    const colour = resolveAdminAssistantNavigationHint(
      'Change my colour scheme to #112233 and #445566',
      'languages'
    );
    expect(colour).toMatchObject({
      section: 'branding',
      target: 'branding-primary-colour',
      label: 'Open Branding · Colours',
      prefill: {
        primaryColour: '#112233',
        secondaryColour: '#445566',
      },
    });
    expect(colour?.steps).toHaveLength(3);

    const rule = resolveAdminAssistantNavigationHint('Create a product rule to hide alcohol', 'catalog');
    expect(rule).toMatchObject({
      section: 'product_rules',
      target: 'product-rule-name',
      label: 'Open Product rules · Prepared draft',
      prefill: {
        openNew: true,
        rule: {
          name: 'Alcohol controls',
          matchConditions: [{ field: 'isAlcohol', operator: 'equals', value: 'true' }],
          actions: [{ type: 'HIDE_PRODUCT' }],
        },
      },
    });
    expect(rule?.steps).toHaveLength(4);

    expect(resolveAdminAssistantNavigationHint('Where do I change Basket to Cart?', 'branding')).toMatchObject({
      section: 'languages',
      target: 'language-copy-header.basket',
      label: 'Open Languages · Wording',
      prefill: {
        copyKey: 'header.basket',
        copyValue: 'Cart',
      },
    });

    expect(resolveAdminAssistantNavigationHint("What is Dave's Delicatessen top selling item?", 'catalog')).toEqual({
      section: 'insights',
      target: undefined,
      label: 'Open Insights',
    });

    expect(resolveAdminAssistantNavigationHint('Upload our brand guidelines and help me set the site up', 'branding')).toMatchObject({
      section: 'branding',
      target: 'branding-brand-profile',
      label: 'Open Branding · Brand Profile',
    });

    expect(resolveAdminAssistantNavigationHint('How do I change opening hours?', 'fees')).toMatchObject({
      section: 'stores',
      target: 'stores-opening-hours',
      label: 'Open Locations · Opening hours',
    });

    expect(resolveAdminAssistantNavigationHint('What branding can I customise?', 'fees')).toMatchObject({
      section: 'branding',
      target: 'branding-logo',
      label: 'Open Branding',
    });
  });

  it('does not invent unsupported time-of-day product rule conditions', () => {
    const result = resolveAdminAssistantNavigationHint(
      'Create a product rule to hide alcohol after 10pm',
      'product_rules'
    );
    expect(result).toMatchObject({
      section: 'product_rules',
      target: 'product-rules-new',
      prefill: { openNew: true },
    });
    expect(result?.steps?.[0].instruction).toContain('do not yet support time-of-day conditions');
  });

  it('prepares deterministic fee and location drafts without saving', () => {
    expect(resolveAdminAssistantNavigationHint('Set delivery fee to £1.99', 'fees')).toMatchObject({
      section: 'fees',
      target: 'fees-fixed-delivery',
      prefill: {
        deliveryFeeMode: 'FIXED',
        fixedDeliveryFeeMajor: 1.99,
      },
    });

    expect(resolveAdminAssistantNavigationHint('Set all delivery radius to 5 km', 'stores')).toMatchObject({
      section: 'stores',
      target: 'stores-batch-radius',
      prefill: {
        selectAllFiltered: true,
        openBatchRadius: true,
        batchRadius: '5',
      },
    });
  });

  it('extracts a product term or explicit identifier from live stock questions', () => {
    expect(extractCatalogLookupQuery('Are bananas in stock?')).toBe('bananas');
    expect(extractCatalogLookupQuery("Why is Dave's Salted Potato Crisps 150g not showing?")).toBe(
      "Dave's Salted Potato Crisps 150g"
    );
    expect(extractCatalogLookupQuery('How about plu DAV001')).toBe('DAV001');
    expect(extractCatalogLookupQuery('DLV1006 How many stores in stock')).toBe('DLV1006');
    expect(extractCatalogLookupQuery('How many locations have barcode 5012345678901?')).toBe('5012345678901');
    expect(extractCatalogLookupQuery('How many locations have stock (unsnooze) of Bananas?')).toBe('Bananas');
    expect(extractCatalogLookupQuery('Can you list all locations with bananas?')).toBe('bananas');
    expect(extractCatalogLookupQuery('Explain stock and ranging')).toBeNull();
  });

  it('inherits the previous product for short conversational follow-ups', () => {
    const history = [
      { role: 'user' as const, content: 'How many locations stock bananas?' },
      { role: 'assistant' as const, content: 'Bananas are in stock at 4 locations.' },
    ];

    expect(resolveContextualCatalogLookupQuery('Which ones?', history)).toBe('bananas');
    expect(resolveContextualCatalogLookupQuery('What about the others?', history)).toBe('bananas');
    expect(resolveContextualCatalogLookupQuery('Why only 3?', history)).toBe('bananas');
    expect(resolveContextualCatalogLookupQuery('Tell me about fees', history)).toBeNull();
  });

  it('retains safe text attachments in chat history', () => {
    const result = normaliseChatHistory([{
      role: 'user',
      content: 'Use this example',
      attachments: [{
        name: 'catalog.csv',
        contentType: 'text/csv',
        content: 'plu,name\\nDLV1006,Bananas',
        byteSize: 30,
      }],
    }]);

    expect(result[0].attachments?.[0].name).toBe('catalog.csv');
    expect(result[0].attachments?.[0].content).toContain('DLV1006');
  });

  it('uses trusted read results in guided mode and remains useful without them', () => {
    expect(
      buildDegradedAssistantReply('catalog', 'Are bananas in stock?', {
        actionName: 'catalog.diagnoseVisibility',
        result: {
          query: 'bananas',
          matches: [{ name: 'Bananas', stockStatus: 'IN_STOCK', stockQuantity: 12 }],
        },
        evidence: [{ source: 'deliverect.searchProducts', ok: true }],
        generatedAt: '2026-09-23T00:00:00.000Z',
      })
    ).toContain('Bananas is reported in stock');

    expect(buildDegradedAssistantReply('catalog', 'What can I do here?')).toContain(
      'safe catalogue read automatically'
    );
    expect(buildDegradedAssistantReply('hero_banners', 'What can I customise?')).toContain(
      'image, headline'
    );

    expect(
      buildDegradedAssistantReply('stores', "Why is Dave's Delicatessen shown twice?", {
        actionName: 'stores.inspect',
        result: {
          storeCount: 2,
          duplicateLocationNames: ["Dave's Delicatessen"],
          stores: [
            {
              id: 'store-a',
              name: "Dave's Delicatessen",
              channelLinkId: 'channel-a',
              physicalLocationId: 'physical-1',
            },
            {
              id: 'store-b',
              name: "Dave's Delicatessen",
              channelLinkId: 'channel-b',
              physicalLocationId: 'physical-1',
            },
          ],
        },
        evidence: [{ source: 'firestore.stores', ok: true }],
        generatedAt: '2026-09-23T00:00:00.000Z',
      })
    ).toContain('same physical location');
  });
});
