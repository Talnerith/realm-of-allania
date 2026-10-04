import { AllaniaProvider, LandingPage } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

export const Landing = () => (
  <div style={{ height: 900 }} className="flex flex-col bg-ink-950">
    <AllaniaProvider signedIn={false}><LandingPage onEnter={noop} /></AllaniaProvider>
  </div>
);
