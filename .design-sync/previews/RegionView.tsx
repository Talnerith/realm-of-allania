import { AllaniaProvider, RegionView } from 'realm-of-aethelraed';
import { ClickSequence, noop } from '../preview-helpers';

const region = { id: 125, name: 'Thornwatch Ridge' };
const frame = (children: React.ReactNode, height = 1100) => <div style={{ height }} className="flex flex-col bg-ink-950">{children}</div>;
const view = (r = region) => <RegionView region={r} setView={noop} setActiveThread={noop} onRequireAuth={noop} />;

// Banner, Locations (left), thread list with tags and stats, Recent activity (right)
export const Region = () => frame(view());

export const NewThreadForm = () => frame(<ClickSequence steps={['New thread']}>{view()}</ClickSequence>, 1300);

// Moderators can rename the region, change its banner and edit the blurb
export const Moderator = () => frame(<AllaniaProvider role="moderator">{view()}</AllaniaProvider>);

export const Guest = () => frame(<AllaniaProvider signedIn={false}>{view()}</AllaniaProvider>);

export const EmptyRegion = () => frame(view({ id: 190, name: 'Silverwood' }));
