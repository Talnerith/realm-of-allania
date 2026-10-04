import { ChatMessage } from 'realm-of-aethelraed';

const at = (minutesAgo: number) => ({ toDate: () => new Date(Date.now() - minutesAgo * 60000) });

export const Conversation = () => (
  <div className="flex flex-col gap-2 w-80 p-4 bg-ink-900 rounded-lg">
    <ChatMessage msg={{ id: 'm1', text: 'Did you see the smoke from the ridge?', createdAt: at(40) }} isMe={false} />
    <ChatMessage msg={{ id: 'm2', text: 'I did. The old waystation, I think.', createdAt: at(35) }} isMe />
    <ChatMessage msg={{ id: 'm3', text: 'Meet me at the waystation at dusk. Bring the signet — and tell no one at the keep.', createdAt: at(12) }} isMe={false} />
  </div>
);

export const FromMe = () => (
  <div className="w-80 p-4 bg-ink-900 rounded-lg">
    <ChatMessage msg={{ id: 'm4', text: 'On my way. Riding east now.', createdAt: at(2) }} isMe />
  </div>
);

export const FromThem = () => (
  <div className="w-80 p-4 bg-ink-900 rounded-lg">
    <ChatMessage msg={{ id: 'm5', text: 'The riders wore silver shoes. Not bandits.', createdAt: at(5) }} isMe={false} />
  </div>
);
