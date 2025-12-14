import React from 'react';

// A lightweight Markdown parser for "Vibe Coding"
// Supports: **bold**, *italic*, __underline__, > quotes, ![img](url), and line breaks.
export default function RichText({ content, className = "" }) {
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
                    {parseInline(line.substring(2))}
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
                {parseInline(line)}
            </p>
        );
      })}
    </div>
  );
}

// Helper: Parses inline styles
function parseInline(text) {
    if (!text) return null;

    // We tokenize the string based on our delimiters
    // Regex explanation:
    // !\[(.*?)\]\((.*?)\)  -> Images: ![alt](url)
    // \*\*.*?\*\* -> Bold
    // \_\_.*?\_\_          -> Underline
    // \*.*?\* -> Italic
    
    // We start with images because they are the most complex
    const imageParts = text.split(/(!\[.*?\]\(.*?\))/g);
    
    return imageParts.map((part, idx) => {
        // IMAGE MATCH
        const imgMatch = part.match(/^!\[(.*?)\]\((.*?)\)$/);
        if (imgMatch) {
            return (
                <img 
                    key={idx} 
                    src={imgMatch[2]} 
                    alt={imgMatch[1]} 
                    className="max-w-full h-auto rounded border border-slate-700 my-2 block"
                    onError={(e) => e.target.style.display='none'}
                />
            );
        }
        
        // If not image, process text formatting
        return <span key={idx}>{parseFormatting(part)}</span>;
    });
}

function parseFormatting(text) {
    // Split by bold (**), underline (__), italic (*)
    // Note: The order matters. We split recursively or use a complex regex.
    // For simplicity in this parser, we map tokens.
    
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