import React, { memo, useState, useEffect, useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
import MarkdownEditor from '@/components/MarkdownEditor';
import RichText from '@/components/RichText';
import LikeButton from '@/components/Forum/LikeButton';
import { hostedImageUrl } from '@/lib/imageUrls';
import { timeAgo } from '@/lib/utils';
import { MAX_POST_LENGTH } from '@/lib/constants';
import useCharacterStats, { joinedLabel } from '@/hooks/useCharacterStats';

const menuItemCls = 'text-left text-sm text-ink-200 hover:bg-ink-800 rounded px-3 py-2 transition-colors';

// Character portrait in a gold ring, or the character's initial underneath
function Portrait({ post, size }) {
    const portrait = hostedImageUrl(post.characterImageUrl);
    const initial = post.characterName ? post.characterName.substring(0, 1) : '?';
    return (
        <div
            className={`relative ${size === 'lg' ? 'w-24 h-24 text-4xl' : 'w-12 h-12 text-xl'} rounded-full overflow-hidden bg-ink-800 border border-gold-700 flex items-center justify-center font-serif font-bold text-gold-300 shrink-0 shadow-[0_0_0_4px_var(--color-ink-900),0_0_0_5px_var(--color-gold-900)]`}
        >
            <span aria-hidden="true">{initial}</span>
            {portrait && (
                <img
                    src={portrait}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ objectPosition: post.characterImagePosition || 'center' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
            )}
        </div>
    );
}

const PostItem = memo(function PostItem({
    post,
    number,
    user,
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
    const stats = useCharacterStats(post.userId, post.characterId);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // The post menu closes on Escape or a click outside it
    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
        const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
    }, [menuOpen]);

    const run = (fn) => () => { setMenuOpen(false); fn(); };
    const meta = [post.characterRace, post.characterClass].filter(Boolean).join(' · ');
    const name = post.characterName || 'Unknown';
    const anchor = number ? `post-${number}` : `post-${post.id}`;
    const openProfile = () => onOpenCodex && onOpenCodex(post.characterId);
    const menuItems = [
        user && !isOwner && onMessageUser && { label: `Message ${name.split(' ')[0]}`, onClick: () => onMessageUser({ id: post.userId, name: post.characterName, characterId: post.characterId }) },
        isOwner && !editingPostId && { label: 'Edit post', onClick: () => onEditStart(post) },
        isAdminOrMod && onCopyUserId && { label: copiedUserId === post.userId ? 'User ID copied' : 'Copy user ID', onClick: () => onCopyUserId(post.userId) },
        isAdmin && onManageUser && { label: 'Manage role', onClick: () => onManageUser({ id: post.userId, name: post.characterName }) },
        isAdminOrMod && !editingPostId && { label: 'Remove post', onClick: () => onDelete(post.id), danger: true },
    ].filter(Boolean);

    const statRows = [
        ['Joined', joinedLabel(stats?.joined)],
        ['Posts', stats?.posts ?? '—'],
        ['Reputation', stats ? stats.reputation : '—'],
    ];
    const label = number ? `Post ${number} by ${name}` : `Post by ${name}`;

    return (
        <article id={anchor} aria-label={label} className="scroll-mt-6 rounded-[14px] bg-(color:--card-bg) border border-(color:--card-border) shadow-(--card-shadow)">
            <div className="flex flex-col md:flex-row md:items-stretch">
                {/* Character profile */}
                <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3 border-b border-ink-800 md:w-48 md:shrink-0 md:flex-col md:flex-nowrap md:text-center md:p-5 md:border-b-0 md:border-r">
                    <button type="button" onClick={openProfile} aria-label={`View ${name}'s profile`} className="rounded-full md:hidden">
                        <Portrait post={post} size="sm" />
                    </button>
                    <button type="button" onClick={openProfile} aria-label={`View ${name}'s profile`} className="rounded-full hidden md:block">
                        <Portrait post={post} size="lg" />
                    </button>
                    <div className="flex flex-col gap-1 min-w-0">
                        <button type="button" onClick={openProfile} className="font-serif font-bold text-xl leading-tight text-gold-100 hover:text-gold-300 text-balance text-left md:text-center transition-colors">
                            {name}
                        </button>
                        {meta && <span className="text-xs text-gold-500">{meta}</span>}
                    </div>
                    <dl className="hidden md:grid w-full grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-2xs text-left mt-2">
                        {statRows.map(([k, v]) => (
                            <React.Fragment key={k}>
                                <dt className="text-ink-400">{k}</dt>
                                <dd className="text-ink-200 text-right tabular-nums">{v}</dd>
                            </React.Fragment>
                        ))}
                    </dl>
                    <span className="md:hidden text-2xs text-ink-400 basis-full">
                        Joined {statRows[0][1]} · {statRows[1][1]} posts · {statRows[2][1]} rep
                    </span>
                </div>

                {/* Post */}
                <div className="flex-1 min-w-0 flex flex-col gap-4 p-4 md:p-6">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-ink-400 flex-1 min-w-0">
                            Posted {timeAgo(post.createdAt)}
                            {post.isEdited && <span className="italic"> · edited</span>}
                            {post.status && post.status !== 'approved' && (
                                <span className="ml-2 rounded border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-2xs font-semibold text-ink-300">
                                    {post.status === 'pending' ? 'Awaiting approval' : post.status === 'rejected' ? 'Rejected' : 'Under review'}
                                </span>
                            )}
                        </span>
                        {number && (
                            <a href={`#${anchor}`} className="text-sm text-ink-400 hover:text-gold-300 tabular-nums transition-colors" title="Link to this post">#{number}</a>
                        )}
                        {menuItems.length > 0 && (
                            <div className="relative" ref={menuRef}>
                                <button type="button" onClick={() => setMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={menuOpen}
                                    aria-label={number ? `Post ${number} options` : 'Post options'}
                                    className="p-1 rounded text-ink-400 hover:text-ink-50 hover:bg-ink-800 transition-colors">
                                    <MoreHorizontal className="w-[18px] h-[18px]" aria-hidden="true" />
                                </button>
                                {menuOpen && (
                                    <div role="menu" className="absolute right-0 top-[calc(100%+.25rem)] z-20 w-44 rounded-[10px] bg-(color:--card-bg) border border-(color:--card-border) shadow-(--card-shadow) p-1 flex flex-col">
                                        {menuItems.map(item => (
                                            <button key={item.label} type="button" role="menuitem" onClick={run(item.onClick)}
                                                className={item.danger ? `${menuItemCls} text-red-400 light:text-red-700` : menuItemCls}>
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="space-y-2">
                            <MarkdownEditor
                                value={editPostContent}
                                onChange={(e) => onEditChange(e.target.value)}
                                minHeight="min-h-[250px]"
                                maxLength={MAX_POST_LENGTH}
                                onWikiLink={onWikiLink}
                            />
                            <div className="flex gap-2 justify-end">
                                <button type="button" onClick={onEditCancel} className="px-3 py-1 text-ink-400 hover:text-ink-50 text-sm">Cancel</button>
                                <button type="button" onClick={onEditSave} className="px-4 py-1.5 bg-gold-700 text-white rounded hover:bg-gold-600 text-sm font-bold">Save edits</button>
                            </div>
                        </div>
                    ) : (
                        <RichText
                            content={post.content}
                            className="font-sans text-base md:text-lg leading-relaxed text-(color:--story)"
                            onWikiLink={onWikiLink}
                        />
                    )}

                    <div className="flex items-center justify-end gap-3 mt-auto">
                        <LikeButton post={post} user={user} />
                    </div>
                </div>
            </div>
        </article>
    );
});

export default PostItem;
