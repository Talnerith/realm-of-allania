import { AllaniaProvider, LandingPage } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

const frame = (children: React.ReactNode) => <div style={{ height: 1700 }} className="flex flex-col bg-ink-950">{children}</div>;

// Signed in: "Welcome back" line and the live site counts
export const Landing = () => frame(<LandingPage onEnter={noop} onNavigate={noop} />);

export const Guest = () => frame(<AllaniaProvider signedIn={false}><LandingPage onEnter={noop} onNavigate={noop} /></AllaniaProvider>);
