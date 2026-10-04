import fs from 'fs';
import path from 'path';
import { FORBIDDEN_KEYWORDS } from './forbiddenKeywords';
import {
  buildForbiddenPattern, buildReservedNamePattern, containsForbiddenText, isReservedName, nameProblem
} from './textRules';

const root = path.resolve(__dirname, '../../..');

// The pattern inside `function <name>(...) { ... .matches('<pattern>') }` in
// firestore.rules, with the rules-literal backslash doubling undone
function rulesPattern(functionName) {
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  const line = rules.split(/\r?\n/).find(l => l.includes(`function ${functionName}(`));
  const literal = line.match(/\.matches\('(.*)'\)/)[1];
  return literal.replace(/\\\\/g, '\\');
}

describe('keyword filter stays in sync', () => {
  it('firestore.rules uses the current forbidden-keyword pattern', () => {
    expect(rulesPattern('hasForbiddenText')).toBe(buildForbiddenPattern());
  });

  it('firestore.rules uses the current reserved-name pattern', () => {
    expect(rulesPattern('isReservedName')).toBe(buildReservedNamePattern());
  });

  it('the Cloud Functions keyword list matches the site\'s', () => {
    const { FORBIDDEN_KEYWORDS: functionsList } = require(path.join(root, 'functions/forbiddenKeywords.js'));
    expect(functionsList).toEqual(FORBIDDEN_KEYWORDS);
  });
});

describe('containsForbiddenText', () => {
  it('catches keywords anywhere, in any case, across lines', () => {
    expect(containsForbiddenText('Get FREE ROBUX now')).toBe(true);
    expect(containsForbiddenText('hello\nbuy crypto today')).toBe(true);
  });

  it('matches short keywords only as whole words', () => {
    expect(containsForbiddenText('kys')).toBe(true);
    expect(containsForbiddenText('just kys.')).toBe(true);
    expect(containsForbiddenText('The skyship over Alkyshire')).toBe(false);
  });

  it('passes ordinary roleplay text', () => {
    expect(containsForbiddenText('I draw my sword and face the dragon.')).toBe(false);
    expect(containsForbiddenText(undefined)).toBe(false);
  });
});

describe('isReservedName / nameProblem', () => {
  it('flags names that impersonate staff', () => {
    expect(isReservedName('Admin')).toBe(true);
    expect(isReservedName('The Moderator')).toBe(true);
    expect(isReservedName('Official Allania')).toBe(true);
  });

  it('allows names that merely contain those letters', () => {
    expect(isReservedName('Modric')).toBe(false);
    expect(isReservedName('Devlin Stormborn')).toBe(false);
    expect(isReservedName('Gmork')).toBe(false);
  });

  it('explains the problem, and lets staff use staff names', () => {
    expect(nameProblem('Aldric')).toBeNull();
    expect(nameProblem('Viagra Seller')).toMatch(/blocked word/);
    expect(nameProblem('Moderator')).toMatch(/staff/);
    expect(nameProblem('Moderator', { allowReserved: true })).toBeNull();
  });
});
