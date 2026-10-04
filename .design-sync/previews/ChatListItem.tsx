import { ChatListItem } from 'realm-of-aethelraed';
import { at, noop } from '../preview-helpers';

const box = (children: React.ReactNode) => <div className="w-80 p-2 bg-ink-900 rounded-lg">{children}</div>;

export const Inbox = () => box(<>
  <ChatListItem chat={{ id: 'chat-1', lastMessage: 'Meet me at the waystation at dusk.', updatedAt: at(12) }} name="Seraphine Ashdown" isUnread onSelect={noop} />
  <ChatListItem chat={{ id: 'chat-2', lastMessage: 'Bring the signet.', updatedAt: at(800) }} name="Brannock Ironhide" isActive onSelect={noop} />
  <ChatListItem chat={{ id: 'chat-3', lastMessage: 'The council meets at moonrise.', updatedAt: at(4000) }} name="Lyra Moonwhisper" onSelect={noop} />
</>);

export const Unread = () => box(
  <ChatListItem chat={{ id: 'chat-1', lastMessage: 'Meet me at the waystation at dusk.', updatedAt: at(12) }} name="Seraphine Ashdown" isUnread onSelect={noop} />
);
