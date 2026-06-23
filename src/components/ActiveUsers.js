import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_ID } from '@/lib/constants';
import { useGame } from '@/context/GameContext';
import { Users, X } from 'lucide-react';

export default function ActiveUsers({ isOpen, onClose }) {
  const { user } = useGame();
  const [activeUsers, setActiveUsers] = useState([]);

  useEffect(() => {
    if (!isOpen || !db) return;

    // Listen to presence collection
    // We order by lastSeen desc to get most recent
    // We limit to 50 to avoid fetching too many
    const q = query(
      collection(db, 'artifacts', APP_ID, 'presence'),
      orderBy('lastSeen', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = [];
      const now = Date.now();
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.lastSeen) {
          const lastSeenTime = data.lastSeen.toMillis();
          // Filter users active in the last 5 minutes (300,000 ms)
          if (now - lastSeenTime < 5 * 60 * 1000) {
            users.push({ id: doc.id, ...data });
          }
        }
      });
      setActiveUsers(users);
    }, (error) => {
      console.error("Error fetching active users:", error);
    });

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-amber-900/50 rounded-lg p-6 w-full max-w-sm shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 text-amber-500">
          <Users className="w-6 h-6" />
          <h2 className="font-serif font-bold text-xl">Active Users</h2>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          {activeUsers.length > 0 ? (
            activeUsers.map((activeUser) => { // Rename to activeUser to avoid conflict
              const isCurrentUser = user && activeUser.id === user.uid;
              return (
                <div key={activeUser.id} className={`flex items-center gap-3 p-2 rounded border transition-colors ${isCurrentUser ? 'bg-amber-900/20 border-amber-800/50' : 'bg-slate-950/50 border-slate-800'}`}>
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isCurrentUser ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                  <span className={`font-medium ${isCurrentUser ? 'text-amber-200' : 'text-slate-200'}`}>
                    {activeUser.username} {isCurrentUser && <span className="text-amber-500 text-xs ml-1">(You)</span>}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-slate-500 text-center py-4 italic">
              The realm is quiet...
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-center text-slate-500">
          {activeUsers.length} soul{activeUsers.length !== 1 ? 's' : ''} present in the realm
        </div>
      </div>
    </div>
  );
}
