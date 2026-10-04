import { AllaniaProvider, ThreadView } from 'realm-of-aethelraed';

const thread = { id: 't-ember', title: 'Smoke over the Ember Road', createdBy: 'Seraphine Ashdown' };
const region = { id: 125, name: 'Thornwatch Ridge' };
const frame = (children: React.ReactNode) => <div style={{ height: 760 }} className="flex flex-col bg-ink-950">{children}</div>;

export const SignedInPlayer = () => frame(<ThreadView thread={thread} region={region} />);

export const Guest = () => frame(
  <AllaniaProvider signedIn={false}>
    <ThreadView thread={thread} region={region} />
  </AllaniaProvider>
);

export const SacredText = () => frame(
  <ThreadView thread={{ id: 't-watch', title: 'The Night Watch at Thornwatch', createdBy: 'Aldric Vane', isLocked: true }} region={region} />
);

export const Moderator = () => frame(
  <AllaniaProvider role="moderator">
    <ThreadView thread={thread} region={region} />
  </AllaniaProvider>
);
