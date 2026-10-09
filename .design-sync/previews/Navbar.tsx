import { AllaniaProvider, Navbar } from 'realm-of-aethelraed';
import { ClickOnMount, ClickSequence, noop } from '../preview-helpers';

// Menus open below the 80px bar, so the frames leave room for them
const bar = (children: React.ReactNode, height = 120, width?: number) => (
  <div style={{ height, width }} className="bg-ink-950">{children}</div>
);
const nav = (view = 'map', unread = 2) => (
  <Navbar currentView={view} setView={noop} onSearch={noop} onToggleChat={noop} onLoginClick={noop} unreadCount={unread} />
);

export const SignedIn = () => bar(nav());

export const OnCodex = () => bar(nav('codex', 0));

export const AccountMenu = () => bar(<ClickOnMount label="Account menu">{nav()}</ClickOnMount>, 380);

export const SearchOpen = () => bar(<ClickSequence steps={['Search']}>{nav()}</ClickSequence>, 200);

export const Moderator = () => bar(
  <AllaniaProvider role="moderator"><ClickOnMount label="Account menu">{nav()}</ClickOnMount></AllaniaProvider>, 400
);

export const Guest = () => bar(<AllaniaProvider signedIn={false}>{nav('landing', 0)}</AllaniaProvider>);
