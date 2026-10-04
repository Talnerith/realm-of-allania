import { AllaniaProvider, Navbar } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

const bar = (children: React.ReactNode) => <div style={{ height: 120 }} className="bg-ink-950">{children}</div>;

export const SignedIn = () => bar(<Navbar currentView="map" setView={noop} onSearch={noop} onToggleChat={noop} onLoginClick={noop} unreadCount={2} />);

export const Guest = () => bar(
  <AllaniaProvider signedIn={false}>
    <Navbar currentView="landing" setView={noop} onSearch={noop} onToggleChat={noop} onLoginClick={noop} unreadCount={0} />
  </AllaniaProvider>
);

export const OnCodex = () => bar(<Navbar currentView="codex" setView={noop} onSearch={noop} onToggleChat={noop} onLoginClick={noop} unreadCount={0} />);
