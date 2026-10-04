import { AllaniaProvider, WorldMap } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

const frame = (children: React.ReactNode) => <div style={{ height: 760 }} className="flex flex-col bg-ink-950">{children}</div>;

export const Map = () => frame(<WorldMap setView={noop} setActiveRegion={noop} />);

export const Guest = () => frame(<AllaniaProvider signedIn={false}><WorldMap setView={noop} setActiveRegion={noop} /></AllaniaProvider>);
