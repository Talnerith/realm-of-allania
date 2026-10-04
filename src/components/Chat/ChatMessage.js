import React, { memo } from 'react';

const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return '';
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatMessage = memo(function ChatMessage({ msg, isMe }) {
    return (
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${isMe ? 'bg-gold-900/40 text-gold-100 border border-gold-900/50' : 'bg-ink-800 text-ink-300 border border-ink-700'}`}>
                {msg.text}
            </div>
            {/* TIMESTAMP */}
            <span className="text-2xs text-ink-500 mt-1 px-1">
                {formatTime(msg.createdAt)}
            </span>
        </div>
    );
});

export default ChatMessage;
