import { ChatSystem } from 'realm-of-aethelraed';
import { Frame, noop } from '../preview-helpers';

export const ConversationList = () => <Frame height={620}><ChatSystem isOpen onClose={noop} /></Frame>;

export const OpenConversation = () => (
  <Frame height={620}>
    <ChatSystem isOpen onClose={noop} initialChatUser={{ id: 'u-seraphine', name: 'Seraphine Ashdown', characterId: 'c-seraphine' }} />
  </Frame>
);
