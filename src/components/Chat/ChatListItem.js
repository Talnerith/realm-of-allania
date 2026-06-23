import React, { memo, useMemo } from 'react';

const ChatListItem = memo(function ChatListItem({ chat, userId, isActive, isUnread, onSelect }) {
    const name = useMemo(() => {
        const otherId = chat.participants.find(p => p !== userId);
        return chat.participantNames?.[otherId] || 'Unknown Traveler';
    }, [chat, userId]);

    const timeDisplay = useMemo(() => {
        return chat.updatedAt?.toDate ? chat.updatedAt.toDate().toLocaleDateString() : '';
    }, [chat.updatedAt]);

    return (
        <div onClick={() => onSelect(chat.id)} className={`p-3 hover:bg-slate-800 rounded cursor-pointer border-b border-slate-800/50 group ${isActive ? 'bg-slate-800' : ''}`}>
            <div className="flex justify-between items-baseline mb-1">
                <div className="flex items-center gap-2">
                    {isUnread && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" title="New Message"></span>}
                    <span className={`font-bold group-hover:text-amber-400 ${isUnread ? 'text-white' : 'text-slate-200'}`}>{name}</span>
                </div>
                <span className="text-[10px] text-slate-600">{timeDisplay}</span>
            </div>
            <p className={`text-sm truncate ${isUnread ? 'text-amber-100 font-medium' : 'text-slate-500'}`}>{chat.lastMessage}</p>
        </div>
    );
});

export default ChatListItem;
