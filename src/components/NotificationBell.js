import { useState, useEffect } from 'react';
import { Bell, X, Check, AlertCircle, Award } from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useGame } from '@/context/GameContext';
import { APP_ID } from '@/lib/constants';

export default function NotificationBell() {
    const { user } = useGame();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    // Listen for notifications
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'artifacts', APP_ID, 'users', user.uid, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.read).length);
        });

        return () => unsub();
    }, [user]);

    if (!user) return null;

    const handleMarkAsRead = async (notificationId) => {
        try {
            await updateDoc(
                doc(db, 'artifacts', APP_ID, 'users', user.uid, 'notifications', notificationId),
                { read: true }
            );
        } catch (e) {
            console.error("Error marking notification as read:", e);
        }
    };

    const handleDelete = async (notificationId) => {
        try {
            await deleteDoc(
                doc(db, 'artifacts', APP_ID, 'users', user.uid, 'notifications', notificationId)
            );
        } catch (e) {
            console.error("Error deleting notification:", e);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const unread = notifications.filter(n => !n.read);
            await Promise.all(
                unread.map(n => 
                    updateDoc(
                        doc(db, 'artifacts', APP_ID, 'users', user.uid, 'notifications', n.id),
                        { read: true }
                    )
                )
            );
        } catch (e) {
            console.error("Error marking all as read:", e);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'promotion':
                return <Award className="w-5 h-5 text-amber-500" />;
            case 'content_rejected':
            case 'image_rejected':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
            default:
                return <Bell className="w-5 h-5 text-slate-400" />;
        }
    };

    return (
        <div className="relative">
            {/* Bell Icon with Badge */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-800"
                title="Notifications"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    
                    {/* Dropdown Panel */}
                    <div className="absolute right-0 mt-2 w-80 md:w-96 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 max-h-[32rem] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900">
                            <h3 className="font-bold text-slate-200 flex items-center gap-2">
                                <Bell className="w-4 h-4 text-amber-500" />
                                Notifications
                            </h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1"
                                >
                                    <Check className="w-3 h-3" />
                                    Mark all read
                                </button>
                            )}
                        </div>

                        {/* Notification List */}
                        <div className="overflow-y-auto custom-scrollbar flex-1">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No notifications yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-800">
                                    {notifications.map(notification => (
                                        <div
                                            key={notification.id}
                                            className={`p-4 hover:bg-slate-800/50 transition-colors group ${
                                                !notification.read ? 'bg-slate-800/30' : ''
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5">
                                                    {getNotificationIcon(notification.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm ${
                                                        !notification.read ? 'text-slate-200 font-medium' : 'text-slate-400'
                                                    }`}>
                                                        {notification.message}
                                                    </p>
                                                    {notification.createdAt && (
                                                        <p className="text-xs text-slate-600 mt-1">
                                                            {notification.createdAt.toDate().toLocaleString()}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {!notification.read && (
                                                        <button
                                                            onClick={() => handleMarkAsRead(notification.id)}
                                                            className="p-1 text-slate-500 hover:text-amber-500 rounded"
                                                            title="Mark as read"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(notification.id)}
                                                        className="p-1 text-slate-500 hover:text-red-500 rounded"
                                                        title="Delete"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

