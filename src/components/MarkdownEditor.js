import React, { useRef } from 'react';
import { Bold, Italic, Underline, Image as ImageIcon, Quote, Code } from 'lucide-react';

export default function MarkdownEditor({ 
  value, 
  onChange, 
  placeholder = "Write your tale...", 
  className = "",
  minHeight = "h-32"
}) {
  const textareaRef = useRef(null);

  const insertSyntax = (prefix, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    // If something is selected, wrap it. If not, just insert markers.
    const newText = `${before}${prefix}${selection || ''}${suffix}${after}`;
    
    // Update parent
    onChange({ target: { value: newText } });

    // Restore focus and cursor position (inside the tags)
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + (selection.length || 0);
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleImage = () => {
    const url = prompt("Enter Image URL:");
    if (url) insertSyntax(`![Image](${url})`, '');
  };

  return (
    <div className={`border border-slate-700 rounded-lg bg-slate-950 overflow-hidden focus-within:border-amber-500 transition-colors ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-slate-900 border-b border-slate-800 overflow-x-auto">
        <ToolButton icon={<Bold className="w-4 h-4"/>} label="Bold" onClick={() => insertSyntax('**', '**')} />
        <ToolButton icon={<Italic className="w-4 h-4"/>} label="Italic" onClick={() => insertSyntax('*', '*')} />
        <ToolButton icon={<Underline className="w-4 h-4"/>} label="Underline" onClick={() => insertSyntax('__', '__')} />
        <div className="w-px h-4 bg-slate-700 mx-1"></div>
        <ToolButton icon={<Quote className="w-4 h-4"/>} label="Quote" onClick={() => insertSyntax('\n> ', '')} />
        <ToolButton icon={<ImageIcon className="w-4 h-4"/>} label="Image" onClick={handleImage} />
      </div>

      {/* Text Area */}
      <textarea
        ref={textareaRef}
        className={`w-full bg-slate-950 p-4 text-slate-200 focus:outline-none font-serif resize-y ${minHeight}`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function ToolButton({ icon, label, onClick }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-slate-800 rounded transition-colors"
      title={label}
    >
      {icon}
    </button>
  );
}