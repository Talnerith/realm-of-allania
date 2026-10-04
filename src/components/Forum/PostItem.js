import React, { memo } from 'react';
import {
    Edit3, Trash2, MessageCircle, User, Shield, Check
} from 'lucide-react';
import MarkdownEditor from '@/components/MarkdownEditor';
import RichText from '@/components/RichText';
import { hostedImageUrl } from '@/lib/imageUrls';

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

    // Portrait, or the character's initial when there is none (an <img> with an
    // empty src shows broken-image alt text instead of the fallback)
    const portrait = hostedImageUrl(post.characterImageUrl);
    const initial = post.characterName ? post.characterName.substring(0, 1) : '?';

    const formatTimestamp = (timestamp) => {
        if (!timestamp?.toDate) return 'Just now';
        return timestamp.toDate().toLocaleString();
    };

    // Small action buttons under the name (DM / copy ID / manage role)
    const actionClass = 'text-2xs bg-ink-800 hover:bg-ink-700 text-ink-400 hover:text-gold-500 border border-ink-700 rounded flex items-center gap-1 transition-colors';
    const initialFill = 'bg-[color-mix(in_oklab,var(--color-gold-900)_40%,var(--color-ink-800))] text-gold-300';

    const actions = (pad) => (
        <>
            {user && user.uid !== post.userId && (
                <button
                    onClick={() => onMessageUser && onMessageUser({ id: post.userId, name: post.characterName, characterId: post.characterId })}
                    className={`${actionClass} ${pad}`}
                    title="Send Message"
                >
                    <MessageCircle className="w-3 h-3" aria-hidden="true" /> DM
                </button>
            )}
            {isAdminOrMod && (
                <button
                    onClick={() => onCopyUserId(post.userId)}
                    className={`${actionClass} ${pad}`}
                    aria-label="Copy User ID"
                    title="Copy User ID"
                >
                    {copiedUserId === post.userId ? <Check className="w-3 h-3 text-emerald-500" aria-hidden="true" /> : <User className="w-3 h-3" aria-hidden="true" />} ID
                </button>
            )}
            {isAdmin && (
                <button
                    onClick={() => onManageUser({ id: post.userId, name: post.characterName })}
                    className={`${actionClass} hover:bg-gold-900 hover:border-gold-700 ${pad}`}
                    title="Manage User Role"
                >
                    <Shield className="w-3 h-3" aria-hidden="true" /> Role
                </button>
            )}
        </>
    );

    return (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 group relative">
            {/* ADMIN TOOLS */}
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all z-10">
                {isOwner && !editingPostId && (
                    <button
                        onClick={() => onEditStart(post)}
                        className="text-ink-500 hover:text-gold-500 bg-ink-900/50 rounded p-1"
                        aria-label="Edit Post"
                        title="Edit Post"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                )}
                {isAdminOrMod && !editingPostId && (
                    <button
                        onClick={() => onDelete(post.id)}
                        className="text-red-700 hover:text-red-500 bg-ink-900/50 rounded p-1"
                        aria-label="Delete Post"
                        title="Delete Post"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* MOBILE AVATAR HEADER */}
            <div className="md:hidden flex items-start gap-3 px-1">
                <button
                    type="button"
                    onClick={() => onOpenCodex && onOpenCodex(post.characterId)}
                    className="w-11 h-11 rounded-[10px] overflow-hidden border border-(color:--card-border) relative shrink-0 cursor-pointer p-0"
                    aria-label={`View ${post.characterName || 'User'}'s profile`}
                >
                    <span className={`absolute inset-0 flex items-center justify-center text-lg font-serif font-bold ${initialFill}`} aria-hidden="true">{initial}</span>
                    {portrait && (
                        <img
                            src={portrait}
                            alt={`${post.characterName}'s avatar`}
                            className="relative w-full h-full object-cover"
                            style={{ objectPosition: post.characterImagePosition || 'center' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    )}
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                            <div className="font-serif text-lg font-bold leading-tight text-gold-500">{post.characterName}</div>
                            <div className="text-2xs text-ink-400 uppercase">{post.characterRace} {post.characterClass}</div>
                        </div>
                        <span className="text-2xs text-ink-400 tabular-nums shrink-0">{formatTimestamp(post.createdAt)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">{actions('px-2 py-1')}</div>
                </div>
            </div>

            {/* DESKTOP AVATAR SIDEBAR */}
            <div className="hidden md:flex flex-col items-center gap-2 w-28 shrink-0">
                <button
                    onClick={() => onOpenCodex && onOpenCodex(post.characterId)}
                    className="w-[5.5rem] h-[5.5rem] rounded-[14px] border border-(color:--card-border) shadow-(--card-shadow) overflow-hidden relative cursor-pointer p-0 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-gold-500"
                    aria-label={`View ${post.characterName || 'User'}'s profile`}
                >
                    <span className={`absolute inset-0 flex items-center justify-center text-3xl font-serif font-bold ${initialFill}`} aria-hidden="true">
                        {initial}
                    </span>
                    {portrait && (
                        <img
                            src={portrait}
                            alt={`${post.characterName || 'User'}'s avatar`}
                            className="relative w-full h-full object-cover"
                            style={{ objectPosition: post.characterImagePosition || 'center' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    )}
                </button>
                <div className="text-center w-full">
                    <button
                        type="button"
                        onClick={() => onOpenCodex && onOpenCodex(post.characterId)}
                        className="mt-1 w-full font-serif font-bold text-[1.0625rem] leading-[1.2] text-gold-500 break-words cursor-pointer hover:underline bg-transparent border-none p-0"
                    >
                        {post.characterName}
                    </button>
                    <div className="mt-0.5 text-2xs leading-[1.45] text-ink-400 uppercase tracking-wider">{post.characterRace} {post.characterClass}</div>
                    <div className="mt-1 flex flex-wrap justify-center gap-1">{actions('px-1.5 py-0.5')}</div>
                </div>
            </div>

            {/* CONTENT CARD */}
            <div className="flex-1 min-w-0 relative rounded-[14px] bg-(color:--card-bg) border border-(color:--card-border) shadow-(--card-shadow) p-4 md:pt-9 md:px-10 md:pb-8 transition-[border-color,box-shadow] duration-200 group-hover:border-[color-mix(in_oklab,var(--color-gold-700)_45%,var(--card-border))]">
                {isEditing ? (
                    <div className="space-y-2 motion-safe:animate-fade-in">
                        <MarkdownEditor
                            value={editPostContent}
                            onChange={(e) => onEditChange(e.target.value)}
                            minHeight="min-h-[250px]"
                            onWikiLink={onWikiLink}
                        />
                        <div className="flex gap-2 justify-end">
                            <button onClick={onEditCancel} className="px-3 py-1 text-ink-400 hover:text-ink-50 text-xs">Cancel</button>
                            <button onClick={onEditSave} className="px-3 py-1 bg-gold-700 text-white rounded hover:bg-gold-600 text-xs">Save Edits</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <RichText
                            content={post.content}
                            className="font-serif text-[1.1875rem] md:text-[1.3125rem] leading-[1.7] text-(color:--story) max-w-[40rem]"
                            onWikiLink={onWikiLink}
                        />
                        <div className="absolute top-3.5 right-5 hidden md:flex gap-2 items-center tabular-nums">
                            {post.isEdited && <span className="text-2xs text-ink-400 italic">(Edited)</span>}
                            <span className="text-2xs text-ink-400">{formatTimestamp(post.createdAt)}</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
});

export default PostItem;
