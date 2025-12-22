import React, { memo, useMemo } from 'react';

const ChatListItem = memo(function ChatListItem({ chat, userId, isActive, onSelect }) {
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
                <span className="font-bold text-slate-200 group-hover:text-amber-400">{name}</span>
                <span className="text-[10px] text-slate-600">{timeDisplay}</span>
            </div>
            <p className="text-sm text-slate-500 truncate">{chat.lastMessage}</p>
        </div>
    );
});

export default ChatListItem;
