import { AllaniaProvider, ThreadView } from 'realm-of-aethelraed';
import { Frame } from '../preview-helpers';

const thread = { id: 't-ember', title: 'Smoke over the Ember Road', createdBy: 'Seraphine Ashdown' };
const region = { id: 125, name: 'Thornwatch Ridge' };

// Frame keeps the fixed reply bar inside the card; the column gives ThreadView its height
const Screen = ({ children, ...provider }: { children: React.ReactNode; [key: string]: unknown }) => (
  <AllaniaProvider {...provider}>
    <Frame height={860}><div className="h-full flex flex-col">{children}</div></Frame>
  </AllaniaProvider>
);

export const DarkGold = () => <Screen theme="dark" accent="gold"><ThreadView thread={thread} region={region} /></Screen>;
export const DarkEmber = () => <Screen theme="dark" accent="ember"><ThreadView thread={thread} region={region} /></Screen>;
export const DarkBrass = () => <Screen theme="dark" accent="brass"><ThreadView thread={thread} region={region} /></Screen>;
export const DarkVerdigris = () => <Screen theme="dark" accent="verdigris"><ThreadView thread={thread} region={region} /></Screen>;
export const LightGold = () => <Screen theme="light" accent="gold"><ThreadView thread={thread} region={region} /></Screen>;
export const LightEmber = () => <Screen theme="light" accent="ember"><ThreadView thread={thread} region={region} /></Screen>;
export const LightBrass = () => <Screen theme="light" accent="brass"><ThreadView thread={thread} region={region} /></Screen>;
export const LightVerdigris = () => <Screen theme="light" accent="verdigris"><ThreadView thread={thread} region={region} /></Screen>;

export const Loading = () => (
  <Screen theme="dark"><ThreadView thread={{ id: '__pending__' }} region={region} /></Screen>
);

export const Empty = () => (
  <Screen theme="dark"><ThreadView thread={{ id: 't-relic', title: 'A Relic Beneath the Ridge' }} region={region} /></Screen>
);

export const Guest = () => <Screen theme="dark" signedIn={false}><ThreadView thread={thread} region={region} /></Screen>;

export const SacredTextModerator = () => (
  <Screen theme="dark" role="moderator">
    <ThreadView thread={{ id: 't-watch', title: 'The Night Watch at Thornwatch', isLocked: true }} region={region} />
  </Screen>
);
