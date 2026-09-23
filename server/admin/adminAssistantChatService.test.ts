import { describe, expect, it } from 'vitest';
import {
  buildAdminAssistantSystemInstruction,
  getAdminAssistantSuggestions,
  normaliseAssistantReply,
  normaliseChatHistory,
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
    expect(instruction).toContain('Write actions must be proposed through the typed ChangeSet flow');
    expect(instruction).toContain('Default to under 90 words');
    expect(instruction).toContain('Use plain text, not Markdown');
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
});
