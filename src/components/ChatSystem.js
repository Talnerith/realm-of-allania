import { useState, useEffect, useRef } from 'react';
import { 
  collection, query, where, onSnapshot, addDoc, 
  serverTimestamp, orderBy, getDocs, doc, updateDoc, setDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID } from '@/lib/constants';
import { MessageCircle, X, Send, User, ChevronLeft, Loader, Trash2 } from 'lucide-react';

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

  // 2. Listen for Messages in Active Chat & MARK READ
  useEffect(() => {
    if (!activeChatId) return;

    // A. Subscribe to Messages
    const q = query(
      collection(db, 'artifacts', APP_ID, 'chats', activeChatId, 'messages'),
      orderBy('createdAt', 'asc')
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
  }, [activeChatId, user]); 

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

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
          // 1. Add message
          await addDoc(collection(db, 'artifacts', APP_ID, 'chats', activeChatId, 'messages'), {
              text: newMessage,
              senderId: user.uid,
              createdAt: serverTimestamp()
          });
          
          // 2. Update chat metadata (bumps updatedAt for everyone)
          await updateDoc(doc(db, 'artifacts', APP_ID, 'chats', activeChatId), {
              lastMessage: newMessage,
              updatedAt: serverTimestamp()
          });

          // 3. Mark my own read receipt so I don't see a notification for my own message
          await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'readReceipts', activeChatId), {
              lastRead: serverTimestamp()
          }, { merge: true });
          
          setNewMessage('');
          setCooldown(true);
          setTimeout(() => setCooldown(false), 1000); // 1 Second Cooldown for Chats
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
          // 1. Delete all messages (Firestore requires deleting subcollections manually or via cloud functions, 
          //    but for client-side cleanliness we'll batch delete what we can see)
          const q = query(collection(db, 'artifacts', APP_ID, 'chats', activeChatId, 'messages'));
          const snapshot = await getDocs(q);
          const batch = writeBatch(db);
          
          snapshot.docs.forEach((doc) => {
              batch.delete(doc.ref);
          });
          
          // 2. Delete the chat document itself
          batch.delete(doc(db, 'artifacts', APP_ID, 'chats', activeChatId));
          
          await batch.commit();
          
          setActiveChatId(null);
      } catch (e) {
          console.error("Error deleting chat:", e);
          alert("Failed to delete chat.");
      }
  };

  const formatTime = (timestamp) => {
      if (!timestamp?.toDate) return '';
      return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 w-full max-w-sm h-[500px] bg-slate-900 border border-amber-900/50 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
      <div className="bg-slate-950 p-3 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
              {activeChatId && (
                  <button onClick={() => setActiveChatId(null)} className="text-slate-400 hover:text-white mr-1">
                      <ChevronLeft className="w-5 h-5"/>
                  </button>
              )}
              <MessageCircle className="w-5 h-5 text-amber-500" />
              <h3 className="font-serif font-bold text-amber-100">
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
                      <Trash2 className="w-4 h-4"/>
                  </button>
              )}
              <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5"/></button>
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
                      chats.map(chat => {
                          const otherId = chat.participants.find(p => p !== user.uid);
                          const name = chat.participantNames?.[otherId] || 'Unknown Traveler';
                          return (
                              <div key={chat.id} onClick={() => setActiveChatId(chat.id)} className="p-3 hover:bg-slate-800 rounded cursor-pointer border-b border-slate-800/50 group">
                                  <div className="flex justify-between items-baseline mb-1">
                                      <span className="font-bold text-slate-200 group-hover:text-amber-400">{name}</span>
                                      <span className="text-[10px] text-slate-600">{chat.updatedAt?.toDate ? chat.updatedAt.toDate().toLocaleDateString() : ''}</span>
                                  </div>
                                  <p className="text-sm text-slate-500 truncate">{chat.lastMessage}</p>
                              </div>
                          );
                      })
                  )}
              </div>
          ) : (
              <div className="p-4 space-y-3 flex flex-col justify-end min-h-full">
                  {messages.map(msg => {
                      const isMe = msg.senderId === user.uid;
                      return (
                          <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              <div className={`max-w-[80%] rounded-lg p-3 text-sm ${isMe ? 'bg-amber-900/40 text-amber-100 border border-amber-900/50' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                                  {msg.text}
                              </div>
                              {/* TIMESTAMP */}
                              <span className="text-[10px] text-slate-600 mt-1 px-1">
                                  {formatTime(msg.createdAt)}
                              </span>
                          </div>
                      );
                  })}
                  <div ref={messagesEndRef} />
              </div>
          )}
      </div>

      {activeChatId && (
          <form onSubmit={sendMessage} className="p-3 bg-slate-950 border-t border-slate-800 shrink-0 flex gap-2">
              <input 
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-amber-500 focus:outline-none text-white placeholder:text-slate-600"
                  placeholder={cooldown ? "Slow down..." : "Type a message..."}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={cooldown}
              />
              <button disabled={isSending || cooldown} className="p-2 bg-amber-700 hover:bg-amber-600 text-white rounded disabled:opacity-50 transition-opacity">
                  {isSending ? <Loader className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
              </button>
          </form>
      )}
    </div>
  );
}