const { validatePostContent, findForbiddenKeyword, WHOLE_WORD_MAX_LENGTH } = require('./validation');
const { FORBIDDEN_KEYWORDS } = require('./forbiddenKeywords');

describe('findForbiddenKeyword', () => {
    it('matches short keywords only as whole words, like textRules.js', () => {
        expect(WHOLE_WORD_MAX_LENGTH).toBe(3); // keep in step with src/lib/moderation/textRules.js
        expect(findForbiddenKeyword('The road to Alkyshire is long')).toBeNull();
        expect(findForbiddenKeyword('Chapter XXXI: The Siege')).toBeNull();
        expect(findForbiddenKeyword('kys')).toBe('kys');
        expect(findForbiddenKeyword('just KYS already')).toBe('kys');
        expect(findForbiddenKeyword('(kys)')).toBe('kys');
        expect(findForbiddenKeyword('Chapter XXX')).toBe('xxx'); // a whole word, as in the rules
        expect(findForbiddenKeyword('xxx_rated')).toBe('xxx'); // "_" is a word boundary there too
    });

    it('matches longer keywords anywhere in the text', () => {
        expect(findForbiddenKeyword('freeviagra4u')).toBe('viagra');
        expect(findForbiddenKeyword('BUY CRYPTO now')).toBe('buy crypto');
        expect(findForbiddenKeyword('pornography')).toBe('porn');
    });

    it('checks every keyword in the list', () => {
        for (const keyword of FORBIDDEN_KEYWORDS) {
            expect(findForbiddenKeyword(`before ${keyword} after`)).toBe(keyword);
        }
    });

    it('ignores non-strings', () => {
        expect(findForbiddenKeyword(undefined)).toBeNull();
    });
});

describe('validatePostContent', () => {
    it('accepts ordinary roleplay that merely contains a short keyword inside a word', () => {
        expect(validatePostContent('Aldric rode north to Alkyshire at dawn.')).toEqual({ isValid: true });
    });

    it('rejects forbidden keywords with the keyword named', () => {
        expect(validatePostContent('Get your free money right here!')).toEqual({
            isValid: false, error: 'Content contains forbidden keyword: free money'
        });
    });

    it('enforces length limits', () => {
        expect(validatePostContent('   ').isValid).toBe(false);
        expect(validatePostContent('too short').isValid).toBe(false);
        expect(validatePostContent('a'.repeat(5001)).isValid).toBe(false);
        expect(validatePostContent('a'.repeat(5001), 10000).isValid).toBe(true);
        expect(validatePostContent(42).isValid).toBe(false);
    });
});
