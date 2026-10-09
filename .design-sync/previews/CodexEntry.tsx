import { AllaniaProvider, CodexEntry } from 'realm-of-aethelraed';
import { at, noop } from '../preview-helpers';

const keep = {
  id: 'k-keep', title: 'Emberfall Keep', category: 'Locations', tags: ['Fortress', 'Frontier'], creatorId: 'u-brannock', status: 'approved', gallery: [], updatedBy: 'Brannock Ironhide', updatedAt: at(600),
  content: 'A fortress of red stone on the eastern frontier, seat of the **Ember Oath**. Its beacon has never gone dark.\n\nThe keep guards the old border road between [[Thornwatch Ridge]] and the Saltmarsh. Travellers who reach its gates after nightfall are given bread, salt and a place by the fire, *no questions asked until morning*.'
};

// Character entry: the opening quote, Race and Class beside the opening, Quick
// Facts, related entries and the closing quote all come from the page text
const aldric = {
  id: 'k-aldric', title: 'Aldric Vane', category: 'Characters', tags: ['Knight', 'Ember Oath'], creatorId: 'u-aldric', status: 'approved', gallery: [], updatedAt: at(4300),
  content: [
    '> The beacon stays lit while I stand.',
    '',
    '**Race:** Human',
    '**Class:** Paladin',
    '**Order:** [[The Ember Oath]]',
    '**Post:** [[Emberfall Keep]]',
    '',
    'A knight of the Ember Oath, sworn to guard the eastern passes.',
    '',
    'Aldric took his vows at seventeen, the youngest in a generation. He has held the Thornwatch road through three winters and two sieges, and speaks of neither.',
    '',
    'Those who ride with him say he prays before every fight and laughs after it.',
    '',
    '> Some knights guard walls. Aldric guards the people behind them.',
  ].join('\n')
};

const frame = (children: React.ReactNode) => <div style={{ minHeight: 640 }} className="bg-ink-950">{children}</div>;

export const Character = () => frame(<CodexEntry page={aldric} goBack={noop} onWikiLink={noop} onOpenEntry={noop} />);

export const Entry = () => frame(<CodexEntry page={keep} goBack={noop} onWikiLink={noop} onOpenEntry={noop} />);

export const SacredText = () => frame(
  <CodexEntry page={{ ...keep, id: 'k-oath', title: 'The Ember Oath', category: 'Organizations', tags: ['Order', 'Faith'], isLocked: true, content: 'An order of knights sworn to keep the beacons of the frontier lit. Members bear the ember sigil.' }} goBack={noop} />
);

export const NewEntry = () => frame(<CodexEntry page={{ isNew: true, title: '', content: '', category: 'Locations', gallery: [] }} goBack={noop} />);

export const ModeratorView = () => frame(
  <AllaniaProvider role="moderator"><CodexEntry page={keep} goBack={noop} onWikiLink={noop} onOpenEntry={noop} /></AllaniaProvider>
);
