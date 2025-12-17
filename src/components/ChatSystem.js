import { useState, useEffect, useRef } from 'react';
import { 
  collection, query, where, onSnapshot, addDoc, 
  serverTimestamp, orderBy, getDocs, doc, updateDoc, setDoc 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID } from '@/lib/constants';
import { MessageCircle, X, Send, User, ChevronLeft, Loader } from 'lucide-react';

export default function ChatSystem({ isOpen, onClose, initialChatUser }) {
  const { user } = useGame();
  const [activeChatId, setActiveChatId] = useState(null);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // If we open with a specific user target, we handle that initialization
  useEffect(() => {
    if (initialChatUser && user) {
        initiateChat(initialChatUser);
    }
  }, [initialChatUser, user]);

  // 1. Listen for My Chats
  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'artifacts', APP_ID, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const c = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setChats(c);
    });

    return () => unsub();
  }, [user]);

  // 2. Listen for Messages in Active Chat
  useEffect(() => {
    if (!activeChatId) return;

    const q = query(
      collection(db, 'artifacts', APP_ID, 'chats', activeChatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const m = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(m);
      scrollToBottom();
    });

    return () => unsub();
  }, [activeChatId]);

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const initiateChat = async (targetUser) => {
      // 1. Check if chat already exists
      const existing = chats.find(c => c.participants.includes(targetUser.id));
      if (existing) {
          setActiveChatId(existing.id);
          return;
      }

      // 2. Create new chat
      try {
          const chatRef = await addDoc(collection(db, 'artifacts', APP_ID, 'chats'), {
              participants: [user.uid, targetUser.id],
              participantNames: {
                  [user.uid]: user.displayName || 'Me',
                  [targetUser.id]: targetUser.name || 'Unknown' // We pass character/user name in targetUser object
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
      
      setIsSending(true);
      try {
          // Add message
          await addDoc(collection(db, 'artifacts', APP_ID, 'chats', activeChatId, 'messages'), {
              text: newMessage,
              senderId: user.uid,
              createdAt: serverTimestamp()
          });
          
          // Update chat metadata
          await updateDoc(doc(db, 'artifacts', APP_ID, 'chats', activeChatId), {
              lastMessage: newMessage,
              updatedAt: serverTimestamp()
          });
          
          setNewMessage('');
      } catch (e) {
          console.error(e);
      } finally {
          setIsSending(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm h-[500px] bg-slate-900 border border-amber-900/50 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
      {/* Header */}
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
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5"/></button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/50">
          {!activeChatId ? (
              // Chat List
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
              // Active Chat
              <div className="p-4 space-y-3 flex flex-col justify-end min-h-full">
                  {messages.map(msg => {
                      const isMe = msg.senderId === user.uid;
                      return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] rounded-lg p-3 text-sm ${isMe ? 'bg-amber-900/40 text-amber-100 border border-amber-900/50' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                                  {msg.text}
                              </div>
                          </div>
                      );
                  })}
                  <div ref={messagesEndRef} />
              </div>
          )}
      </div>

      {/* Input Area (Only visible when active chat) */}
      {activeChatId && (
          <form onSubmit={sendMessage} className="p-3 bg-slate-950 border-t border-slate-800 shrink-0 flex gap-2">
              <input 
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-amber-500 focus:outline-none text-white placeholder:text-slate-600"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
              />
              <button disabled={isSending} className="p-2 bg-amber-700 hover:bg-amber-600 text-white rounded disabled:opacity-50">
                  {isSending ? <Loader className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
              </button>
          </form>
      )}
    </div>
  );
}