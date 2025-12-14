import React from 'react';

// A lightweight Markdown parser for "Vibe Coding"
// Supports: **bold**, *italic*, > quotes, and line breaks.
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
            <p key={i} className="leading-relaxed">
                {parseInline(line)}
            </p>
        );
      })}
    </div>
  );
}

// Helper: Parses **bold** and *italic*
function parseInline(text) {
    // We split by bold tokens first: **text**
    const boldParts = text.split(/(\*\*.*?\*\*)/g);
    
    return boldParts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            // It's bold, now check for italics inside or just render bold
            const content = part.slice(2, -2);
            return <strong key={idx} className="text-amber-100 font-bold">{parseItalic(content)}</strong>;
        }
        // Not bold, check for italics
        return <span key={idx}>{parseItalic(part)}</span>;
    });
}

function parseItalic(text) {
    const parts = text.split(/(\*.*?\*)/g);
    return parts.map((part, idx) => {
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={idx} className="text-amber-200/80">{part.slice(1, -1)}</em>;
        }
        return part;
    });
}