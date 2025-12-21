import React, { useRef, useState, useEffect } from 'react';
import { Bold, Italic, Underline, Image as ImageIcon, Quote, Eye, Edit2, Send, Loader, Link2 } from 'lucide-react';
import RichText from '@/components/RichText';

export default function MarkdownEditor({ 
  value, 
  onChange, 
  placeholder = "Write your tale...", 
  className = "",
  minHeight = "min-h-[120px]", 
  onPost = null,               
  submitLabel = "Post",        
  disabled = false,            // Disables the INPUT area
  isSubmitting = false,        // Shows spinner
  isSubmitDisabled = false,    // Disables only the POST BUTTON
  onWikiLink = null            // Pass this for preview to work clickable
}) {
  const textareaRef = useRef(null);
  const [isPreview, setIsPreview] = useState(false);

  // Auto-Resize Logic
  useEffect(() => {
    if (textareaRef.current && !isPreview) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 500)}px`;
    }
  }, [value, isPreview]);

  const insertSyntax = (prefix, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const scrollTop = textarea.scrollTop;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    const newText = `${before}${prefix}${selection || ''}${suffix}${after}`;
    onChange({ target: { value: newText } });

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + (selection.length || 0);
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.scrollTop = scrollTop; 
    }, 0);
  };

  const handleImage = () => {
    const url = prompt("Enter Image URL:");
    if (url) insertSyntax(`![Image](${url})`, '');
  };
  
  const handleWikiLink = () => {
    const pageName = prompt("Enter the Page Title to link to:");
    if (pageName) insertSyntax(`[[${pageName}]]`, '');
  };

  return (
    <div className={`border border-slate-700 rounded-lg bg-slate-950 overflow-hidden focus-within:border-amber-500 transition-colors flex flex-col shadow-sm ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <ToolButton icon={<Bold className="w-4 h-4"/>} label="Bold" onClick={() => insertSyntax('**', '**')} disabled={isPreview || disabled} />
          <ToolButton icon={<Italic className="w-4 h-4"/>} label="Italic" onClick={() => insertSyntax('*', '*')} disabled={isPreview || disabled} />
          <ToolButton icon={<Underline className="w-4 h-4"/>} label="Underline" onClick={() => insertSyntax('__', '__')} disabled={isPreview || disabled} />
          <div className="w-px h-4 bg-slate-700 mx-1"></div>
          <ToolButton icon={<Quote className="w-4 h-4"/>} label="Quote" onClick={() => insertSyntax('\n> ', '')} disabled={isPreview || disabled} />
          <ToolButton icon={<Link2 className="w-4 h-4"/>} label="Wiki Link" onClick={handleWikiLink} disabled={isPreview || disabled} />
          <ToolButton icon={<ImageIcon className="w-4 h-4"/>} label="Image" onClick={handleImage} disabled={isPreview || disabled} />
        </div>
        
        {/* Right Side: Preview & Optional Post Button */}
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setIsPreview(!isPreview)}
                className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold transition-colors ${isPreview ? 'bg-amber-900/50 text-amber-200 border border-amber-700/50' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
                {isPreview ? <><Edit2 className="w-3 h-3"/> Edit</> : <><Eye className="w-3 h-3"/> Preview</>}
            </button>

            {/* INTEGRATED POST BUTTON */}
            {onPost && (
              <button 
                  onClick={onPost}
                  disabled={disabled || isSubmitting || isSubmitDisabled}
                  className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-3 py-1 rounded text-xs font-bold shadow-lg shadow-amber-900/20 transition-all hover:scale-105 ml-2"
              >
                  {isSubmitting ? <Loader className="w-3 h-3 animate-spin"/> : <Send className="w-3 h-3" />}
                  {submitLabel}
              </button>
            )}
        </div>
      </div>

      {/* Editor / Preview Area */}
      <div className="relative w-full bg-slate-950">
          {isPreview ? (
              <div className={`w-full p-4 overflow-y-auto custom-scrollbar bg-slate-900/30 prose prose-invert prose-p:text-slate-300 prose-headings:text-amber-100 max-w-none ${minHeight} max-h-[500px]`}>
                  {value ? <RichText content={value} onWikiLink={onWikiLink} /> : <span className="text-slate-600 italic">Nothing to preview...</span>}
              </div>
          ) : (
              <textarea
                ref={textareaRef}
                className={`w-full bg-slate-950 p-4 text-slate-200 focus:outline-none font-serif resize-none block custom-scrollbar ${minHeight}`}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                disabled={disabled}
                style={{ maxHeight: '500px' }}
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