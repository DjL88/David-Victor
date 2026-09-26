import { describe, expect, it } from 'vitest';
import {
  ALTIE_KNOWLEDGE_VERSION,
  selectAltieKnowledge,
} from './altieKnowledge';

describe('Altie curated knowledge', () => {
  it('is versioned and exposes repository provenance for catalogue guidance', () => {
    const selected = selectAltieKnowledge({
      section: 'catalog',
      message: 'Why is this product hidden from the catalogue?',
    });

    expect(ALTIE_KNOWLEDGE_VERSION).toMatch(/^2026-09-26\./);
    expect(selected.version).toBe(ALTIE_KNOWLEDGE_VERSION);
    expect(selected.topics.map((topic) => topic.id)).toContain('catalogue');
    expect(selected.topics.map((topic) => topic.id)).toContain('operator-safety');
    expect(selected.sources.every((source) => source.reviewedAt === '2026-09-26')).toBe(true);
    expect(selected.sources.some((source) => source.source.includes('adminAssistantActionService'))).toBe(true);
  });

  it('provides useful presets for rules, search, Insights, publishing and diagnostics', () => {
    const sections = ['product_rules', 'search_merch', 'insights', 'branding', 'connection_health'];
    for (const section of sections) {
      const selected = selectAltieKnowledge({ section });
      expect(selected.presets.length, section).toBeGreaterThan(0);
    }
  });

  it('keeps unsupported search execution explicit rather than inventing a save path', () => {
    const selected = selectAltieKnowledge({ section: 'search_merch' });
    const search = selected.topics.find((topic) => topic.id === 'search');
    expect(search?.facts.join(' ')).toContain('no registered Altie search write action');
  });
});
