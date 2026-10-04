import { AllaniaProvider, RegionView } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

const region = { id: 125, name: 'Thornwatch Ridge' };
const frame = (children: React.ReactNode) => <div style={{ height: 820 }} className="flex flex-col bg-ink-950">{children}</div>;

export const Region = () => frame(<RegionView region={region} setView={noop} setActiveThread={noop} />);

export const Guest = () => frame(
  <AllaniaProvider signedIn={false}><RegionView region={region} setView={noop} setActiveThread={noop} /></AllaniaProvider>
);

export const EmptyRegion = () => frame(<RegionView region={{ id: 190, name: 'Silverwood' }} setView={noop} setActiveThread={noop} />);
