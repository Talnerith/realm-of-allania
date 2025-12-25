import React, { memo } from 'react';
import {
    Edit3, Trash2, MessageCircle, User, Shield, Gavel, Check, Ghost
} from 'lucide-react';
import MarkdownEditor from '@/components/MarkdownEditor';
import RichText from '@/components/RichText';

const PostItem = memo(function PostItem({
    post,
    user,
    activeCharId,
    isAdmin,
    isAdminOrMod,
    editingPostId,
    editPostContent,
    onEditStart,
    onEditSave,
    onEditCancel,
    onEditChange,
    onDelete,
    onMessageUser,
    onOpenCodex,
    onCopyUserId,
    onManageUser,
    onWikiLink,
    copiedUserId
}) {
    const isOwner = user && user.uid === post.userId;
    const isEditing = editingPostId === post.id;

    const formatTimestamp = (timestamp) => {
        if (!timestamp?.toDate) return 'Just now';
        return timestamp.toDate().toLocaleString();
    };

    return (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 group relative">
            {/* ADMIN TOOLS */}
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-10">
                {isOwner && !editingPostId && (
                    <button
                        onClick={() => onEditStart(post)}
                        className="text-slate-500 hover:text-amber-500 bg-slate-900/50 rounded p-1"
                        aria-label="Edit Post"
                        title="Edit Post"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                )}
                {isAdminOrMod && !editingPostId && (
                    <button
                        onClick={() => onDelete(post.id)}
                        className="text-red-900/50 hover:text-red-500 bg-slate-900/50 rounded p-1"
                        aria-label="Delete Post"
                        title="Delete Post"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* MOBILE AVATAR HEADER */}
            <div className="md:hidden flex items-center gap-3 bg-slate-800/50 p-2 rounded-t-lg border-b border-slate-700">
                <button
                    type="button"
                    onClick={() => onOpenCodex && onOpenCodex(post.characterId)}
                    className="w-10 h-10 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 relative shrink-0 cursor-pointer p-0"
                >
                    <img
                        src={post.characterImageUrl || ''}
                        alt={`${post.characterName}'s avatar`}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: post.characterImagePosition || 'center' }}
                        onError={(e) => e.target.style.display = 'none'}

                    />
                </button>
                <div className="flex-1">
                    <div className="text-amber-500 font-bold text-sm">{post.characterName}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{post.characterRace} {post.characterClass}</div>
                </div>
                <span className="text-[10px] text-slate-600">{formatTimestamp(post.createdAt)}</span>
            </div>

            {/* DESKTOP AVATAR SIDEBAR */}
            <div className="hidden md:flex flex-col items-center gap-2 w-24 shrink-0">
                <button
                    onClick={() => onOpenCodex && onOpenCodex(post.characterId)}
                    className="w-20 h-20 bg-slate-800 rounded-lg border-2 border-slate-700 overflow-hidden shadow-lg relative bg-cover bg-center cursor-pointer hover:border-amber-500 transition-colors p-0"
                    aria-label={`View ${post.characterName || 'User'}'s profile`}

                >
                    <img
                        src={post.characterImageUrl || ''}
                        alt={`${post.characterName || 'User'}'s avatar`}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: post.characterImagePosition || 'center' }}
                        onError={(e) => e.target.style.display = 'none'}

                    />
                    <span className="absolute inset-0 flex items-center justify-center text-3xl bg-slate-700 text-slate-300 font-bold -z-10">
                        {post.characterName ? post.characterName.substring(0, 1) : '?'}
                    </span>

                </button>
                <div className="text-center w-full">
                    <button
                        type="button"
                        onClick={() => onOpenCodex && onOpenCodex(post.characterId)}
                        className="text-xs font-bold text-amber-500 truncate w-full cursor-pointer hover:underline bg-transparent border-none p-0"
                    >
                        {post.characterName}
                    </button>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">{post.characterRace} {post.characterClass}</div>

                    {/* Buttons */}
                    <div className="mt-1 flex flex-wrap justify-center gap-1">
                        {user && user.uid !== post.userId && (
                            <button
                                onClick={() => onMessageUser && onMessageUser({ id: post.userId, name: post.characterName })}
                                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-500 border border-slate-700 rounded px-1.5 py-0.5 flex items-center gap-1 transition-colors"
                                title="Send Message"
                            >
                                <MessageCircle className="w-3 h-3" /> DM
                            </button>
                        )}
                        {isAdminOrMod && (
                            <button
                                onClick={() => onCopyUserId(post.userId)}
                                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-500 border border-slate-700 rounded px-1.5 py-0.5 flex items-center gap-1 transition-colors"
                                aria-label="Copy User ID"
                                title="Copy User ID"
                            >
                                {copiedUserId === post.userId ? <Check className="w-3 h-3 text-emerald-500" /> : <User className="w-3 h-3" />} ID
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                onClick={() => onManageUser({ id: post.userId, name: post.characterName })}
                                className="text-[10px] bg-slate-800 hover:bg-amber-900 text-slate-400 hover:text-amber-500 border border-slate-700 hover:border-amber-700 rounded px-1.5 py-0.5 flex items-center gap-1 transition-colors"
                                title="Manage User Role"
                            >
                                <Shield className="w-3 h-3" /> Role
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* CONTENT CARD */}
            <div className="flex-1 bg-slate-900/50 border border-slate-800 p-4 md:p-6 rounded-xl md:rounded-tl-none relative shadow-sm">
                {isEditing ? (
                    <div className="space-y-2">
                        <MarkdownEditor
                            value={editPostContent}
                            onChange={(e) => onEditChange(e.target.value)}
                            minHeight="min-h-[250px]"
                            onWikiLink={onWikiLink}
                        />
                        <div className="flex gap-2 justify-end">
                            <button onClick={onEditCancel} className="px-3 py-1 text-slate-400 hover:text-white text-xs">Cancel</button>
                            <button onClick={onEditSave} className="px-3 py-1 bg-amber-700 text-white rounded hover:bg-amber-600 text-xs">Save Edits</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="prose prose-invert prose-p:text-slate-300 prose-headings:text-amber-100 max-w-none">
                            <RichText content={post.content} className="font-serif text-lg" onWikiLink={onWikiLink} />
                        </div>
                        <div className="absolute top-2 right-4 hidden md:flex gap-2 items-center">
                            {post.isEdited && <span className="text-[10px] text-slate-600 italic">(Edited)</span>}
                            <span className="text-[10px] text-slate-700">{formatTimestamp(post.createdAt)}</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
});

export default PostItem;
