import { useState, useEffect, useRef, useCallback } from 'react';
import {
    collection, query, where, onSnapshot, addDoc,
    serverTimestamp, orderBy, getDocs, doc, updateDoc, setDoc, deleteDoc, writeBatch, limitToLast
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID } from '@/lib/constants';
import { MessageCircle, X, Send, ChevronLeft, Loader, Trash2 } from 'lucide-react';
import ChatMessage from '@/components/Chat/ChatMessage';
import ChatListItem from '@/components/Chat/ChatListItem';

export default function ChatSystem({ isOpen, onClose, initialChatUser }) {
    const { user } = useGame();
    const [activeChatId, setActiveChatId] = useState(null);
    const [chats, setChats] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [cooldown, setCooldown] = useState(false); // Rate Limit

    // If we open with a specific user target, we handle that initialization
    useEffect(() => {
        if (initialChatUser && user) {
            initiateChat(initialChatUser);
        }
    }, [initialChatUser, user]);

    // 1. Listen for My Chats
    useEffect(() => {
        if (!user) return;

        // FIX: Removed 'orderBy' to prevent "Requires Index" error.
        const q = query(
            collection(db, 'artifacts', APP_ID, 'chats'),
            where('participants', 'array-contains', user.uid)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const c = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // FIX: Sort by date (newest first) in JavaScript
            c.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
            setChats(c);
        });

        return () => unsub();
    }, [user]);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, []);

    // 2. Listen for Messages in Active Chat & MARK READ
    useEffect(() => {
        if (!activeChatId) return;

        // OPTIMIZATION: Added limitToLast(50) to prevent loading thousands of messages
        const q = query(
            collection(db, 'artifacts', APP_ID, 'chats', activeChatId, 'messages'),
            orderBy('createdAt', 'asc'),
            limitToLast(50)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const m = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setMessages(m);
            scrollToBottom();
        });

        // B. Mark as Read (Update Read Receipt)
        if (user) {
            setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', activeChatId), {
                lastRead: serverTimestamp()
            }, { merge: true });
        }

        return () => unsub();
    }, [activeChatId, user, scrollToBottom]);

    // Scroll on Open
    useEffect(() => {
        if (isOpen && activeChatId) {
            scrollToBottom();
        }
    }, [isOpen, activeChatId, scrollToBottom]);

    const messagesEndRef = useRef(null);

    const initiateChat = async (targetUser) => {
        const existing = chats.find(c => c.participants.includes(targetUser.id));
        if (existing) {
            setActiveChatId(existing.id);
            return;
        }
        try {
            const chatRef = await addDoc(collection(db, 'artifacts', APP_ID, 'chats'), {
                participants: [user.uid, targetUser.id],
                participantNames: {
                    [user.uid]: user.displayName || 'Me',
                    [targetUser.id]: targetUser.name || 'Unknown'
                },
                updatedAt: serverTimestamp(),
                lastMessage: 'Chat started'
            });
            setActiveChatId(chatRef.id);
        } catch (e) {
            console.error("Error starting chat:", e);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChatId) return;
        if (cooldown) return;

        setIsSending(true);
        try {
            // OPTIMIZATION: Use Batch Write for atomicity and speed (1 RTT instead of 3)
            const batch = writeBatch(db);

            // 1. Add message ref
            const msgRef = doc(collection(db, 'artifacts', APP_ID, 'chats', activeChatId, 'messages'));
            batch.set(msgRef, {
                text: newMessage,
                senderId: user.uid,
                createdAt: serverTimestamp()
            });

            // 2. Update chat metadata
            const chatRef = doc(db, 'artifacts', APP_ID, 'chats', activeChatId);
            batch.update(chatRef, {
                lastMessage: newMessage,
                updatedAt: serverTimestamp()
            });

            // 3. Update my read receipt
            const receiptRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', activeChatId);
            batch.set(receiptRef, { lastRead: serverTimestamp() }, { merge: true });

            await batch.commit();

            setNewMessage('');
            setCooldown(true);
            scrollToBottom();
            setTimeout(() => setCooldown(false), 1000);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSending(false);
        }
    };

    const deleteChat = async () => {
        if (!activeChatId || !user) return;
        if (!window.confirm("Are you sure? This will delete the ENTIRE chat history for BOTH users.")) return;

        try {
            // 1. Fetch all messages
            const q = query(collection(db, 'artifacts', APP_ID, 'chats', activeChatId, 'messages'));
            const snapshot = await getDocs(q);

            // 2. CHUNK DELETION LOOP (Safeguard against 500 batch limit)
            if (!snapshot.empty) {
                const chunks = [];
                const docs = snapshot.docs;

                // Split into chunks of 450
                for (let i = 0; i < docs.length; i += 450) {
                    chunks.push(docs.slice(i, i + 450));
                }

                // Execute batches
                for (const chunk of chunks) {
                    const batch = writeBatch(db);
                    chunk.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();
                }
            }

            // 3. Delete the chat document itself
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'chats', activeChatId));

            setActiveChatId(null);
        } catch (e) {
            console.error("Error deleting chat:", e);
            alert("Failed to delete chat.");
        }
    };

    if (!isOpen) return null;

    return (
        // FIX: Adjusted layout for mobile (inset-0) vs desktop (bottom-20 right-4 w-96)
        <div className="fixed z-50 flex flex-col bg-slate-900 border border-amber-900/50 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:rounded-xl md:w-96 md:h-[500px] md:bottom-20 md:right-4 inset-0 md:inset-auto">
            <div className="bg-slate-950 p-3 border-b border-slate-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    {activeChatId && (
                        <button onClick={() => setActiveChatId(null)} className="text-slate-400 hover:text-white mr-1">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}
                    <MessageCircle className="w-5 h-5 text-amber-500" />
                    <h3 className="font-serif font-bold text-amber-100 truncate max-w-[150px]">
                        {activeChatId
                            ? (chats.find(c => c.id === activeChatId)?.participantNames?.[chats.find(c => c.id === activeChatId)?.participants.find(p => p !== user.uid)] || 'Chat')
                            : 'Messages'
                        }
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    {/* DELETE BUTTON */}
                    {activeChatId && (
                        <button onClick={deleteChat} className="text-slate-600 hover:text-red-500 mr-2" title="Delete Chat Forever">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/50">
                {!activeChatId ? (
                    <div className="p-2">
                        {chats.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 text-sm p-4">
                                <p>No messages yet.</p>
                                <p className="mt-2 text-xs">Visit a thread and click a user's avatar to send them a message.</p>
                            </div>
                        ) : (
                            chats.map(chat => (
                                <ChatListItem
                                    key={chat.id}
                                    chat={chat}
                                    userId={user.uid}
                                    isActive={activeChatId === chat.id}
                                    onSelect={setActiveChatId}
                                />
                            ))
                        )}
                    </div>
                ) : (
                    <div className="p-4 space-y-3 flex flex-col justify-end min-h-full">
                        {messages.map(msg => (
                            <ChatMessage
                                key={msg.id}
                                msg={msg}
                                isMe={msg.senderId === user.uid}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {activeChatId && (
                <form onSubmit={sendMessage} className="p-3 bg-slate-950 border-t border-slate-800 shrink-0 flex gap-2 pb-safe">
                    <input
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-amber-500 focus:outline-none text-white placeholder:text-slate-600"
                        placeholder={cooldown ? "Slow down..." : "Type a message..."}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={cooldown}
                    />
                    <button disabled={isSending || cooldown} className="p-2 bg-amber-700 hover:bg-amber-600 text-white rounded disabled:opacity-50 transition-opacity">
                        {isSending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </form>
            )}
        </div>
    );
}