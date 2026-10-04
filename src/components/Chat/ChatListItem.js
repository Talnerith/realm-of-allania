import React, { memo, useMemo } from 'react';

// name: the chat partner's character name, resolved by ChatSystem
const ChatListItem = memo(function ChatListItem({ chat, name, isActive, isUnread, onSelect }) {

    const timeDisplay = useMemo(() => {
        return chat.updatedAt?.toDate ? chat.updatedAt.toDate().toLocaleDateString() : '';
    }, [chat.updatedAt]);

    return (
        <div onClick={() => onSelect(chat.id)} className={`p-3 hover:bg-ink-800 rounded cursor-pointer border-b border-ink-800/50 group ${isActive ? 'bg-ink-800' : ''}`}>
            <div className="flex justify-between items-baseline mb-1">
                <div className="flex items-center gap-2">
                    {isUnread && <span className="w-2 h-2 rounded-full bg-gold-500 animate-pulse shrink-0" title="New Message"></span>}
                    <span className={`font-bold group-hover:text-gold-400 ${isUnread ? 'text-ink-50' : 'text-ink-200'}`}>{name}</span>
                </div>
                <span className="text-2xs text-ink-500">{timeDisplay}</span>
            </div>
            <p className={`text-sm truncate ${isUnread ? 'text-gold-100 font-medium' : 'text-ink-500'}`}>{chat.lastMessage}</p>
        </div>
    );
});

export default ChatListItem;
