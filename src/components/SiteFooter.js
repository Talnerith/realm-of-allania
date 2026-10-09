import { memo } from 'react';
import { CONTACT_EMAIL } from '@/lib/constants';
import { CREST_IMG, FOOTER_BANNER_IMG } from '@/lib/artAssets';

const PATREON_URL = process.env.NEXT_PUBLIC_PATREON_URL;

const LEGAL_LINKS = [
    { tab: 'tos', label: 'Terms of Service' },
    { tab: 'privacy', label: 'Privacy Policy' },
    { tab: 'cookies', label: 'Cookie Policy' },
];

// The footer sits on a night-sky painting in every theme, so its text uses
// fixed light colours (never text-ink-*, which turns dark in light theme).
const heading = 'text-xs uppercase tracking-widest font-bold text-(color:--a-400)';
const link = 'text-left text-sm text-[#e8e2d4] hover:text-(color:--a-300) transition-colors';

function SiteFooter({ onOpenLegal }) {
    return (
        <footer className="relative overflow-hidden bg-[rgb(1_12_28)]">
            <img
                src={FOOTER_BANNER_IMG.src}
                srcSet={FOOTER_BANNER_IMG.srcSet}
                sizes="100vw"
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover object-[88%_72%] pointer-events-none"
            />
            {/* Readability shade, darkest behind the text on the left */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgb(1_12_28/.78)_0%,rgb(1_12_28/.6)_55%,rgb(1_12_28/.25)_100%)]" />
            {/* Blend the top edge into the page */}
            <div className="absolute inset-x-0 top-0 h-12 pointer-events-none bg-linear-to-b from-ink-950 to-transparent" />

            <div className="relative max-w-7xl mx-auto px-4 md:px-8 pt-14 pb-10 flex flex-col gap-8">
                <div className="flex flex-wrap justify-between gap-x-12 gap-y-8">
                    <div className="flex flex-col gap-3 max-w-xs">
                        <div className="flex items-center gap-3">
                            <img src={CREST_IMG.src} srcSet={CREST_IMG.srcSet} alt="" className="h-14 w-auto block" />
                            <span className="flex flex-col">
                                <span className="font-serif font-bold leading-none text-2xl md:text-3xl text-[#f3ecdc]">Realm of Allania</span>
                                <span className="uppercase leading-none text-xs tracking-[.32em] mt-[.45rem] text-(color:--a-400)">Chronicles</span>
                            </span>
                        </div>
                        <p className="font-serif italic text-lg text-[#d6cfbf]">A living world, written together.</p>
                    </div>

                    <nav aria-label="Legal" className="flex flex-col gap-2">
                        <span className={heading}>Legal</span>
                        {LEGAL_LINKS.map(l => (
                            <button key={l.tab} type="button" onClick={() => onOpenLegal?.(l.tab)} className={link}>
                                {l.label}
                            </button>
                        ))}
                    </nav>

                    <div className="flex flex-col gap-2">
                        <span className={heading}>Contact</span>
                        <a href={`mailto:${CONTACT_EMAIL}`} className={link}>{CONTACT_EMAIL}</a>
                        <span className="text-sm text-[#c9c2b3]">We reply within a few days.</span>
                    </div>

                    {PATREON_URL && (
                        <div className="flex flex-col gap-3 max-w-64">
                            <span className={heading}>Support the Realm</span>
                            <span className="text-sm text-[#c9c2b3]">Donations keep the servers running and the map growing.</span>
                            <a
                                href={PATREON_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 self-start rounded bg-gold-700 hover:bg-gold-600 text-white text-sm font-bold px-4 py-2 transition-colors"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="15" cy="9.5" r="6.5" /><rect x="3" y="3" width="3.5" height="18" /></svg>
                                Support us on Patreon
                            </a>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-[rgb(243_236_220/.15)]">
                    <span className="text-sm text-[#c9c2b3]">© {new Date().getFullYear()} Realm of Allania</span>
                </div>
            </div>
        </footer>
    );
}

export default memo(SiteFooter);
