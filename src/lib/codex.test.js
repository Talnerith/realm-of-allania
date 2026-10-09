import { parseCodexContent, sectionForCategory, cleanCodexTags, codexTagStyle } from '@/lib/codex';

jest.mock('@/lib/artAssets', () => ({
  CODEX_ART: {
    hero: { mobile: 'h-m', desktop: 'h-d' },
    characters: { banner: {}, medallion: 'c' }, locations: { banner: {}, medallion: 'l' }, history: { banner: {}, medallion: 'h' },
  },
}));

describe('sectionForCategory', () => {
  it('groups the old categories into the three sections', () => {
    expect(sectionForCategory('Characters').id).toBe('characters');
    expect(sectionForCategory('Species').id).toBe('characters');
    expect(sectionForCategory('Regions').id).toBe('locations');
    expect(sectionForCategory('Magic and Powers').id).toBe('history');
    expect(sectionForCategory(undefined).id).toBe('history');
  });
});

describe('cleanCodexTags', () => {
  it('trims, dedupes case-insensitively, caps length and count', () => {
    expect(cleanCodexTags([' Noble ', 'noble', 'Ruler', 'x'.repeat(40), 'Extra'])).toEqual(['Noble', 'Ruler', 'x'.repeat(24)]);
    expect(cleanCodexTags(undefined)).toEqual([]);
  });

  it('gives each tag a stable colour', () => {
    expect(codexTagStyle('Noble')).toEqual(codexTagStyle('Noble'));
  });
});

describe('parseCodexContent', () => {
  const content = [
    '> A blade in the dunes, a shadow in the courts.',
    '',
    '**Race:** Human',
    '**Class:** Rogue / Thief',
    '**Allegiance:** The Ember Oath',
    '**Home:** [[Breville]]',
    '',
    'Zekiel walks where the sun forgets to burn.',
    '',
    'He was born in the dunes and raised by [[Lady Anne]].',
    'He never speaks of it.',
    '',
    '> Some men leave footprints. Zekiel leaves questions.',
  ].join('\n');

  it('reads facts, quotes, paragraphs and links', () => {
    const p = parseCodexContent(content);
    expect(p.epigraph).toBe('A blade in the dunes, a shadow in the courts.');
    expect(p.closing).toBe('Some men leave footprints. Zekiel leaves questions.');
    expect(p.facts.map(f => f.label)).toEqual(['Race', 'Class', 'Allegiance', 'Home']);
    expect(p.facts[0].value).toBe('Human');
    expect(p.paragraphs).toEqual([
      'Zekiel walks where the sun forgets to burn.',
      'He was born in the dunes and raised by [[Lady Anne]].\nHe never speaks of it.',
    ]);
    expect(p.related).toEqual(['Breville', 'Lady Anne']);
  });

  it('handles plain text and the auto-created character format', () => {
    expect(parseCodexContent('Just one paragraph of lore.')).toEqual({ facts: [], epigraph: '', closing: '', paragraphs: ['Just one paragraph of lore.'], related: [] });
    const auto = parseCodexContent('**Race:** Elf\n**Class:** Druid\n\nTracker of the Silverwood.');
    expect(auto.facts).toHaveLength(2);
    expect(auto.paragraphs).toEqual(['Tracker of the Silverwood.']);
  });
});
