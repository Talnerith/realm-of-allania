import React, { memo } from 'react';
import { hostedImageUrl } from '@/lib/imageUrls';
import { NAME_SCROLL_IMG, EDIT_PEN_IMG } from '@/lib/artAssets';

// The nameplate is parchment in every theme, so its ink colours are fixed
const NAME_INK = '#140c03';
const META_INK = '#3a2a12';

// A roster card: the portrait fills a gold-framed 2.2:1 card with a parchment
// nameplate over its bottom-left and the quill edit button bottom-right.
const CharacterListItem = memo(function CharacterListItem({ char, isActive, onSelect, onEdit }) {
    const portrait = hostedImageUrl(char.imageUrl);
    const meta = [char.race, char.class].filter(Boolean).join(' · ');

    return (
        <div
            onClick={() => onSelect(char.id)}
            className={`relative w-full aspect-[2.2/1] cursor-pointer bg-ink-950 p-[3px] transition-shadow ${isActive
                ? 'border-2 border-gold-400 shadow-[0_0_0_1px_var(--color-gold-700),0_0_22px_var(--color-gold-700)]'
                : 'border border-gold-600 shadow-[0_6px_18px_rgb(0_0_0/.35)] hover:border-gold-400'}`}
        >
            <div className="relative w-full h-full overflow-hidden border border-gold-900 bg-ink-900">
                {/* Initial underneath; the portrait (if any) covers it */}
                <div
                    className="absolute inset-0 flex items-center justify-center bg-ink-900 bg-[radial-gradient(ellipse_at_50%_30%,color-mix(in_oklab,var(--color-gold-900)_45%,transparent),transparent_70%)]"
                    aria-hidden="true"
                >
                    <span className="font-serif font-bold text-gold-500 leading-none text-[clamp(4rem,3rem+3vw,6rem)] mb-[22%]">{char.name?.[0]}</span>
                </div>
                {portrait && (
                    <img
                        src={portrait}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ objectPosition: char.imagePosition || 'center' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                )}

                {/* Nameplate: the text stays on the solid parchment (7%-63% of its width) */}
                <img
                    src={NAME_SCROLL_IMG.src}
                    srcSet={NAME_SCROLL_IMG.srcSet}
                    sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw"
                    alt=""
                    className="absolute left-0 bottom-0 w-full aspect-[640/140] block pointer-events-none"
                />
                <div className="absolute left-0 bottom-0 w-full aspect-[640/140] flex flex-col justify-center pl-[7%] pr-[37%] pointer-events-none">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSelect(char.id); }}
                        aria-pressed={isActive}
                        className="flex flex-col min-w-0 text-left pointer-events-auto rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                    >
                        <span
                            className="font-serif font-bold leading-none truncate w-full text-[clamp(1.4375rem,1.15rem+.8vw,1.875rem)] tracking-[.01em] [text-shadow:0_1px_0_rgb(255_248_228/.7)]"
                            style={{ color: NAME_INK }}
                        >
                            {char.name}
                        </span>
                        {meta && (
                            <span
                                className="font-sans font-semibold leading-tight truncate w-full text-[clamp(.75rem,.7rem+.2vw,.875rem)] tracking-[.02em] mt-[.3rem]"
                                style={{ color: META_INK }}
                            >
                                {meta}
                            </span>
                        )}
                    </button>
                </div>

                <button
                    type="button"
                    onClick={(e) => onEdit(e, char)}
                    aria-label={`Edit ${char.name}`}
                    title={`Edit ${char.name}`}
                    className="absolute right-[3%] bottom-[6%] w-12 block transition-transform hover:scale-105 drop-shadow-[0_3px_5px_rgb(0_0_0/.5)] rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                >
                    <img src={EDIT_PEN_IMG.src} srcSet={EDIT_PEN_IMG.srcSet} alt="" className="w-full h-auto block" />
                </button>

                {isActive && (
                    <span className="absolute top-2 left-2 flex items-center gap-1 bg-ink-950 border border-gold-500 text-gold-300 uppercase font-bold rounded-sm px-2 py-[.2rem] text-2xs tracking-[.16em] pointer-events-none">
                        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0l5 5-5 5-5-5z" fill="currentColor" /></svg>
                        Active
                    </span>
                )}
            </div>
        </div>
    );
});

export default CharacterListItem;
