import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
    collection, query, where, onSnapshot, addDoc,
    serverTimestamp, orderBy, getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc, writeBatch, limitToLast
} from 'firebase/firestore';
import { containsForbiddenText } from '@/lib/moderation/textRules';
import { db } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID } from '@/lib/constants';
import { MessageCircle, X, Send, ChevronLeft, Loader, Trash2 } from 'lucide-react';
import ChatMessage from '@/components/Chat/ChatMessage';
import ChatListItem from '@/components/Chat/ChatListItem';

function ChatSystem({ isOpen, onClose, initialChatUser, onUnreadCountChange }) {
    // readReceipts comes from GameContext (chat_id -> millis) — avoids a
    // second listener on the same collection
    const { user, readReceipts, characters, activeCharId } = useGame();
    const [activeChatId, setActiveChatId] = useState(null);
    const [chats, setChats] = useState([]);
    const [chatsLoaded, setChatsLoaded] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [cooldown, setCooldown] = useState(false); // Rate Limit
    const [sendError, setSendError] = useState(null);

    // Define initiateChat before it's used in useEffect
    const initiateChat = useCallback(async (targetUser) => {
        if (targetUser.id === user.uid) return;
        const existing = chats.find(c => c.participants.includes(targetUser.id));
        if (existing) {
            setActiveChatId(existing.id);
            return;
        }
        // Chats are between characters: each side is shown under the real name
        // of the character they chat as (the rules check both exist), so
        // nobody can choose a misleading label for themselves or the other person
        const myCharId = activeCharId || characters[0]?.id;
        if (!myCharId) {
            alert("Create a character before starting a chat.");
            return;
        }
        if (!targetUser.characterId) {
            alert("This player can't be messaged from here.");
            return;
        }
        try {
            const chatRef = await addDoc(collection(db, 'artifacts', APP_ID, 'chats'), {
                participants: [user.uid, targetUser.id],
                participantCharacters: {
                    [user.uid]: myCharId,
                    [targetUser.id]: targetUser.characterId
                },
                updatedAt: serverTimestamp(),
                lastMessage: 'Chat started'
            });
            setActiveChatId(chatRef.id);
        } catch (e) {
            console.error("Error starting chat:", e);
        }
    }, [chats, user, characters, activeCharId]);

    // If we open with a specific user target, initiate exactly once per target.
    // Without the ref guard, every chats snapshot re-runs this effect and
    // yanks the user back into the conversation (or, before the first
    // snapshot arrives, creates a duplicate chat doc).
    const initiatedForRef = useRef(null);
    useEffect(() => {
        if (!initialChatUser) {
            initiatedForRef.current = null;
            return;
        }
        if (!user || !chatsLoaded) return;
        if (initiatedForRef.current === initialChatUser.id) return;
        initiatedForRef.current = initialChatUser.id;
        initiateChat(initialChatUser);
    }, [initialChatUser, user, chatsLoaded, initiateChat]);

    // 1. Listen for My Chats
    useEffect(() => {
        if (!user || !db) return;

        const q = query(
            collection(db, 'artifacts', APP_ID, 'chats'),
            where('participants', 'array-contains', user.uid),
            orderBy('updatedAt', 'desc')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const c = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setChats(c);
            setChatsLoaded(true);
        });

        return () => { unsub(); setChatsLoaded(false); };
    }, [user]);

    // Resolve chat partners' names from their characters (cached per character)
    const [characterNames, setCharacterNames] = useState({});
    useEffect(() => {
        if (!user || !db) return;
        const missing = new Set();
        for (const chat of chats) {
            const otherId = chat.participants.find(p => p !== user.uid);
            const charId = chat.participantCharacters?.[otherId];
            if (charId && !(`${otherId}/${charId}` in characterNames)) missing.add(`${otherId}/${charId}`);
        }
        if (missing.size === 0) return;

        let cancelled = false;
        Promise.all([...missing].map(async (key) => {
            const [uid, charId] = key.split('/');
            try {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'users', uid, 'characters', charId));
                return [key, snap.exists() ? snap.data().name : 'Departed Traveler'];
            } catch {
                return [key, 'Unknown Traveler'];
            }
        })).then((entries) => {
            if (!cancelled) setCharacterNames(prev => ({ ...prev, ...Object.fromEntries(entries) }));
        });
        return () => { cancelled = true; };
    }, [chats, user, characterNames]);

    const partnerName = useCallback((chat) => {
        if (!chat || !user) return 'Chat';
        const otherId = chat.participants.find(p => p !== user.uid);
        const charId = chat.participantCharacters?.[otherId];
        if (charId) return characterNames[`${otherId}/${charId}`] || '…';
        // Chats started before character-linked names
        return chat.participantNames?.[otherId] || 'Unknown Traveler';
    }, [characterNames, user]);

    // Calculate Unread Count
    useEffect(() => {
        if (!onUnreadCountChange) return;

        const count = chats.reduce((acc, chat) => {
            // If chat has no updatedAt (e.g. just created), ignore
            if (!chat.updatedAt) return acc;

            // Unread if: No receipt OR chat.updatedAt > lastRead
            // (GameContext receipts are already millis)
            const chatTime = chat.updatedAt.toMillis ? chat.updatedAt.toMillis() : 0;
            const readTime = readReceipts[chat.id] || 0;

            return (chatTime > readTime) ? acc + 1 : acc;
        }, 0);

        onUnreadCountChange(count);
    }, [chats, readReceipts, onUnreadCountChange]);

    const isChatUnread = (chatId) => {
        const chat = chats.find(c => c.id === chatId);
        if (!chat || !chat.updatedAt) return false;
        const chatTime = chat.updatedAt.toMillis ? chat.updatedAt.toMillis() : 0;
        const readTime = readReceipts[chatId] || 0;
        return chatTime > readTime;
    };

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

            // Mark as read only on first load or when the latest message is
            // from the other user — our own sends already write a receipt in
            // sendMessage, and writing on every snapshot doubles writes (and
            // re-creates receipt docs mid-deleteChat)
            const last = m[m.length - 1];
            if (user && (!last || last.senderId !== user.uid)) {
                setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', activeChatId), {
                    lastRead: serverTimestamp()
                }, { merge: true });
            }
        });

        return () => unsub();
    }, [activeChatId, user, scrollToBottom]);

    // Scroll on Open
    useEffect(() => {
        if (isOpen && activeChatId) {
            scrollToBottom();
        }
    }, [isOpen, activeChatId, scrollToBottom]);

    // Reset active chat when closed to ensure we stop "reading" messages
    useEffect(() => {
        if (!isOpen) {
            // Closing the panel ends the conversation view (a one-off reset, not a loop)
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveChatId(null);
        }
    }, [isOpen]);

    const messagesEndRef = useRef(null);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChatId) return;
        if (cooldown) return;
        // Same word filter the rules enforce, checked here for a clear message
        if (containsForbiddenText(newMessage)) {
            setSendError("That message contains a blocked word.");
            return;
        }

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
                // The rules allow one message per write: the one named here
                lastMessageId: msgRef.id,
                updatedAt: serverTimestamp()
            });

            // 3. Update my read receipt
            const receiptRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', activeChatId);
            batch.set(receiptRef, { lastRead: serverTimestamp() }, { merge: true });

            await batch.commit();

            setNewMessage('');
            setSendError(null);
            setCooldown(true);
            scrollToBottom();
            setTimeout(() => setCooldown(false), 1000);
        } catch (e) {
            console.error(e);
            // Most likely the server-side flood limit (1 msg/sec) or a connection issue
            setSendError("Message not sent — you're sending too fast, or the connection dropped.");
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

    // if (!isOpen) return null;

    if (!isOpen && !onUnreadCountChange) return null; // Safety fallback if not used for notifications

    return (
        // FIX: Adjusted layout for mobile (inset-0) vs desktop (bottom-20 right-4 w-96)
        <div className={`fixed z-50 flex flex-col bg-ink-900 border border-gold-900/50 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:rounded-xl md:w-96 md:h-[500px] md:bottom-20 md:right-4 inset-0 md:inset-auto ${isOpen ? '' : 'hidden'}`}>
            <div className="bg-ink-950 p-3 border-b border-ink-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    {activeChatId && (
                        <button
                            onClick={() => setActiveChatId(null)}
                            className="text-ink-400 hover:text-ink-50 mr-1"
                            aria-label="Back to chat list"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}
                    <MessageCircle className="w-5 h-5 text-gold-500" />
                    <h3 className="font-serif font-bold text-gold-100 truncate max-w-[150px]">
                        {activeChatId
                            ? partnerName(chats.find(c => c.id === activeChatId))
                            : 'Messages'
                        }
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    {/* DELETE BUTTON */}
                    {activeChatId && (
                        <button
                            onClick={deleteChat}
                            className="text-ink-600 hover:text-red-500 mr-2"
                            title="Delete Chat Forever"
                            aria-label="Delete chat forever"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="text-ink-500 hover:text-ink-50"
                        aria-label="Close chat window"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-ink-900/50">
                {!activeChatId ? (
                    <div className="p-2">
                        {chats.length === 0 ? (
                            <div className="text-center py-8 text-ink-500 text-sm p-4">
                                <p>No messages yet.</p>
                                <p className="mt-2 text-xs">Visit a thread and click a user&apos;s avatar to send them a message.</p>
                            </div>
                        ) : (
                            chats.map(chat => (
                                <ChatListItem
                                    key={chat.id}
                                    chat={chat}
                                    name={partnerName(chat)}
                                    isActive={activeChatId === chat.id}
                                    isUnread={isChatUnread(chat.id)}
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
                <form onSubmit={sendMessage} className="p-3 bg-ink-950 border-t border-ink-800 shrink-0 flex flex-col gap-2 pb-safe">
                    {sendError && (
                        <div className="text-red-400 text-xs px-1" role="alert">{sendError}</div>
                    )}
                    <div className="flex gap-2">
                    <input
                        className="flex-1 bg-ink-900 border border-ink-700 rounded px-3 py-2 text-sm focus:border-gold-500 focus:outline-none text-ink-50 placeholder:text-ink-600"
                        placeholder={cooldown ? "Slow down..." : "Type a message..."}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={cooldown}
                        maxLength={2000}
                        aria-label="Message text"
                    />
                    <button
                        type="submit"
                        disabled={isSending || cooldown}
                        className="p-2 bg-gold-700 hover:bg-gold-600 text-white rounded disabled:opacity-50 transition-opacity"
                        aria-label={isSending ? "Sending message" : "Send message"}
                    >
                        {isSending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                    </div>
                </form>
            )}
        </div>
    );
}

export default memo(ChatSystem);