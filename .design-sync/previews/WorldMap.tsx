import { AllaniaProvider, WorldMap } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

// WorldMap fills its parent's width at the map's fixed 2816x1504 aspect
const frame = (children: React.ReactNode) => <div style={{ width: 1200 }} className="bg-ink-950">{children}</div>;

export const Map = () => frame(<WorldMap setView={noop} setActiveRegion={noop} onRegionHover={noop} />);

export const Guest = () => frame(<AllaniaProvider signedIn={false}><WorldMap setView={noop} setActiveRegion={noop} /></AllaniaProvider>);
