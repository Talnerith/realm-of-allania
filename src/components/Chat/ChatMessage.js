import React, { memo } from 'react';

const formatTime = (timestamp) => {
    if (!timestamp?.toDate) return '';
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatMessage = memo(function ChatMessage({ msg, isMe }) {
    return (
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${isMe ? 'bg-amber-900/40 text-amber-100 border border-amber-900/50' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                {msg.text}
            </div>
            {/* TIMESTAMP */}
            <span className="text-[10px] text-slate-600 mt-1 px-1">
                {formatTime(msg.createdAt)}
            </span>
        </div>
    );
});

export default ChatMessage;
