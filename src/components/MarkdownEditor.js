import React, { useRef, useState } from 'react';
import { Bold, Italic, Underline, Image as ImageIcon, Quote, Eye, Edit2 } from 'lucide-react';
import RichText from '@/components/RichText';

export default function MarkdownEditor({ 
  value, 
  onChange, 
  placeholder = "Write your tale...", 
  className = "",
  minHeight = "h-64" // Increased default height
}) {
  const textareaRef = useRef(null);
  const [isPreview, setIsPreview] = useState(false);

  const insertSyntax = (prefix, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Capture current scroll position to prevent jumping
    const scrollTop = textarea.scrollTop;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    const newText = `${before}${prefix}${selection || ''}${suffix}${after}`;
    
    onChange({ target: { value: newText } });

    // Restore focus, cursor, and SCROLL position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + (selection.length || 0);
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.scrollTop = scrollTop; // The Fix
    }, 0);
  };

  const handleImage = () => {
    const url = prompt("Enter Image URL:");
    if (url) insertSyntax(`![Image](${url})`, '');
  };

  return (
    <div className={`border border-slate-700 rounded-lg bg-slate-950 overflow-hidden focus-within:border-amber-500 transition-colors flex flex-col ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <ToolButton icon={<Bold className="w-4 h-4"/>} label="Bold" onClick={() => insertSyntax('**', '**')} disabled={isPreview} />
          <ToolButton icon={<Italic className="w-4 h-4"/>} label="Italic" onClick={() => insertSyntax('*', '*')} disabled={isPreview} />
          <ToolButton icon={<Underline className="w-4 h-4"/>} label="Underline" onClick={() => insertSyntax('__', '__')} disabled={isPreview} />
          <div className="w-px h-4 bg-slate-700 mx-1"></div>
          <ToolButton icon={<Quote className="w-4 h-4"/>} label="Quote" onClick={() => insertSyntax('\n> ', '')} disabled={isPreview} />
          <ToolButton icon={<ImageIcon className="w-4 h-4"/>} label="Image" onClick={handleImage} disabled={isPreview} />
        </div>
        
        {/* Preview Toggle */}
        <button 
            onClick={() => setIsPreview(!isPreview)}
            className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold transition-colors ${isPreview ? 'bg-amber-900/50 text-amber-200 border border-amber-700/50' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
            {isPreview ? <><Edit2 className="w-3 h-3"/> Edit</> : <><Eye className="w-3 h-3"/> Preview</>}
        </button>
      </div>

      {/* Editor / Preview Area */}
      <div className={`relative flex-1 ${minHeight}`}>
          {isPreview ? (
              <div className="w-full h-full p-4 overflow-y-auto custom-scrollbar bg-slate-900/30 prose prose-invert prose-p:text-slate-300 prose-headings:text-amber-100 max-w-none">
                  {value ? <RichText content={value} /> : <span className="text-slate-600 italic">Nothing to preview...</span>}
              </div>
          ) : (
              <textarea
                ref={textareaRef}
                className="w-full h-full bg-slate-950 p-4 text-slate-200 focus:outline-none font-serif resize-none"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
              />
          )}
      </div>
    </div>
  );
}

function ToolButton({ icon, label, onClick, disabled }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-slate-800 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
      title={label}
    >
      {icon}
    </button>
  );
}