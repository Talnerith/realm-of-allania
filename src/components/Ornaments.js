// Gold frame ornaments shared by the map frame, the roster drawer and the
// codex portraits. A gem is a diamond with an ink-950 face, a gold-500 rim
// and a gold-500 centre; position it with className/style.
export function Gem({ size = 22, className = '', style }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            aria-hidden="true"
            className={`absolute z-[2] pointer-events-none ${className}`}
            style={style}
        >
            <path d="M12 1l11 11-11 11L1 12z" fill="var(--color-ink-950)" stroke="var(--color-gold-500)" strokeWidth="1.2" />
            <path d="M12 6l6 6-6 6-6-6z" fill="var(--color-gold-500)" />
        </svg>
    );
}

// Double gold rule (1px gold-600, a gap, 1px gold-900) with a gem centred
// on it; used along the drawer's top edge and under its bar.
export function GoldRule({ gap = 3, className = '' }) {
    return (
        <div className={`relative shrink-0 pointer-events-none ${className}`} aria-hidden="true">
            <div className="border-t border-gold-600" />
            <div className="border-t border-gold-900" style={{ marginTop: gap }} />
            <Gem size={22} style={{ left: 'calc(50% - 11px)', top: -11 }} />
        </div>
    );
}
