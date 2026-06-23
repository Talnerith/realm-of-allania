import React from 'react';

// A lightweight Markdown parser for "Vibe Coding"
// Supports: **bold**, *italic*, __underline__, > quotes, ![img](url), [[WikiLink]], and line breaks.
const RichText = React.memo(function RichText({ content, className = "", onWikiLink }) {
    if (!content) return null;

    // 1. Split by newlines to handle paragraphs/blockquotes
    const lines = content.split('\n');

    return (
        <div className={`space-y-2 ${className}`}>
            {lines.map((line, i) => {
                // Handle Blockquotes
                if (line.startsWith('> ')) {
                    return (
                        <blockquote key={i} className="border-l-4 border-amber-600/50 pl-4 italic text-slate-400 bg-slate-900/30 py-1">
                            {parseInline(line.substring(2), onWikiLink)}
                        </blockquote>
                    );
                }

                // Handle Empty Lines (Paragraph breaks)
                if (!line.trim()) {
                    return <div key={i} className="h-2"></div>;
                }

                // Standard Paragraph
                return (
                    <p key={i} className="leading-relaxed whitespace-pre-wrap">
                        {parseInline(line, onWikiLink)}
                    </p>
                );
            })}
        </div>
    );
});

export default RichText;

// Helper: Parses inline styles
function parseInline(text, onWikiLink) {
    if (!text) return null;

    // We tokenize the string based on our delimiters
    // Regex explanation:
    // !\[(.*?)\]\((.*?)\)  -> Images: ![alt](url)
    // \[\[(.*?)\]\]        -> Wiki Links: [[Page Title]] or [[Page Title|Display Text]]
    // \*\*.*?\*\* -> Bold
    // \_\_.*?\_\_          -> Underline
    // \*.*?\* -> Italic

    // We handle Images and Wiki Links first as they are distinct blocks
    const parts = text.split(/(!\[.*?\]\(.*?\)|\[\[.*?\]\])/g);

    return parts.map((part, idx) => {
        // IMAGE MATCH
        const imgMatch = part.match(/^!\[(.*?)\]\((.*?)\)$/);
        if (imgMatch) {
            return (
                <img
                    key={idx}
                    src={imgMatch[2]}
                    alt={imgMatch[1]}
                    className="max-w-full h-auto rounded border border-slate-700 my-2 block"
                    onError={(e) => e.target.style.display = 'none'}
                />
            );
        }

        // WIKI LINK MATCH
        const wikiMatch = part.match(/^\[\[(.*?)\]\]$/);
        if (wikiMatch) {
            const inner = wikiMatch[1];
            // Support [[Target|Display]] syntax
            const [target, display] = inner.includes('|') ? inner.split('|') : [inner, inner];

            return (
                <button
                    key={idx}
                    onClick={(e) => { e.stopPropagation(); if (onWikiLink) onWikiLink(target.trim()); }}
                    className="text-amber-400 hover:text-amber-200 hover:underline font-bold decoration-amber-500/30 decoration-2 underline-offset-2 transition-colors inline-block"
                    title={`Go to: ${target}`}
                >
                    {display.trim()}
                </button>
            );
        }

        // If not special block, process formatting (Bold/Italic/etc)
        return <span key={idx}>{parseFormatting(part)}</span>;
    });
}

function parseFormatting(text) {
    // Split by bold (**), underline (__), italic (*)
    const tokens = text.split(/(\*\*.*?\*\*|\_\_.*?\_\_|\*.*?\*)/g);

    return tokens.map((token, i) => {
        if (token.startsWith('**') && token.endsWith('**')) {
            return <strong key={i} className="text-amber-100 font-bold">{token.slice(2, -2)}</strong>;
        }
        if (token.startsWith('__') && token.endsWith('__')) {
            return <u key={i} className="decoration-amber-500/50 underline-offset-4">{token.slice(2, -2)}</u>;
        }
        if (token.startsWith('*') && token.endsWith('*')) {
            return <em key={i} className="text-amber-200/80">{token.slice(1, -1)}</em>;
        }
        return token;
    });
}