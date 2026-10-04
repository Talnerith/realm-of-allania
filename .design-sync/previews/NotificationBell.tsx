import { NotificationBell } from 'realm-of-aethelraed';
import { Frame, ClickOnMount, at } from '../preview-helpers';

const notifications = [
  { id: 'n-1', type: 'reply', message: 'Seraphine Ashdown replied in "Smoke over the Ember Road".', read: false, createdAt: at(18) },
  { id: 'n-2', type: 'promotion', message: 'Your codex page "The Ember Oath" was approved.', read: false, createdAt: at(300) },
  { id: 'n-3', type: 'content_rejected', message: 'Your post was rejected: Content contains forbidden keyword: free money', read: true, createdAt: at(4000) }
];
const corner = (children: React.ReactNode, height: number) => (
  <Frame height={height}><div className="flex justify-end p-4 bg-ink-900 border-b border-ink-800">{children}</div></Frame>
);

export const WithUnread = () => corner(<NotificationBell notifications={notifications} />, 120);

export const Open = () => corner(
  <ClickOnMount label="Notifications"><NotificationBell notifications={notifications} /></ClickOnMount>, 460
);

export const AllRead = () => corner(<NotificationBell notifications={notifications.map((n) => ({ ...n, read: true }))} />, 120);
