import { AllaniaProvider, CodexEntry } from 'realm-of-aethelraed';
import { at, noop } from '../preview-helpers';

const keep = {
  id: 'k-keep', title: 'Emberfall Keep', category: 'Locations', gallery: [], updatedBy: 'Brannock Ironhide', updatedAt: at(600),
  content: 'A fortress of red stone on the eastern frontier, seat of the **Ember Oath**. Its beacon has never gone dark.\n\nThe keep guards the old border road between [[Thornwatch Ridge]] and the Saltmarsh. Travellers who reach its gates after nightfall are given bread, salt and a place by the fire, *no questions asked until morning*.'
};
const frame = (children: React.ReactNode) => <div style={{ minHeight: 640 }} className="bg-ink-950">{children}</div>;

export const Entry = () => frame(<CodexEntry page={keep} goBack={noop} onWikiLink={noop} />);

export const SacredText = () => frame(
  <CodexEntry page={{ ...keep, id: 'k-oath', title: 'The Ember Oath', category: 'Organizations', isLocked: true, content: 'An order of knights sworn to keep the beacons of the frontier lit. Members bear the ember sigil.' }} goBack={noop} />
);

export const NewEntry = () => frame(<CodexEntry page={{ isNew: true, title: '', content: '', category: 'Locations', gallery: [] }} goBack={noop} />);

export const ModeratorView = () => frame(
  <AllaniaProvider role="moderator"><CodexEntry page={keep} goBack={noop} onWikiLink={noop} /></AllaniaProvider>
);
