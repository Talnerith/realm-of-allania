import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Bold, Italic, Underline, Image as ImageIcon, Quote, Eye, Edit2, Send, Loader, Link2 } from 'lucide-react';
import RichText from '@/components/RichText';
import { isHostedImageUrl, importImageFromUrl } from '@/lib/imageUrls';

const MarkdownEditor = React.memo(function MarkdownEditor({
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
  onWikiLink = null
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

  const insertSyntax = useCallback((prefix, suffix = '') => {
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
  }, [onChange]);

  // Pasted links are copied into our Storage (and moderated) before use
  const handleImage = useCallback(async () => {
    const url = prompt("Enter Image URL:");
    if (!url) return;
    try {
      const hostedUrl = isHostedImageUrl(url) ? url : await importImageFromUrl(url, 'uploads');
      insertSyntax(`![Image](${hostedUrl})`, '');
    } catch (e) {
      alert(e.message);
    }
  }, [insertSyntax]);

  const handleWikiLink = useCallback(() => {
    const pageName = prompt("Enter the Page Title to link to:");
    if (pageName) insertSyntax(`[[${pageName}]]`, '');
  }, [insertSyntax]);

  return (
    <div className={`min-w-0 border border-ink-700 rounded-xl bg-ink-950 overflow-hidden focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-500/[0.22] transition-[border-color,box-shadow] flex flex-col shadow-sm ${className}`}>
      {/* Toolbar: format buttons may scroll, actions never shrink. Tighter below 520px so nothing clips. */}
      <div className="flex items-center justify-between gap-2 p-2 max-[520px]:p-1.5 max-[520px]:gap-1.5 bg-ink-900 border-b border-ink-800 shrink-0">
        <div className="flex items-center gap-1 max-[520px]:gap-0 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          <ToolButton icon={<Bold className="w-4 h-4" />} label="Bold" onClick={() => insertSyntax('**', '**')} disabled={isPreview || disabled} />
          <ToolButton icon={<Italic className="w-4 h-4" />} label="Italic" onClick={() => insertSyntax('*', '*')} disabled={isPreview || disabled} />
          <ToolButton icon={<Underline className="w-4 h-4" />} label="Underline" onClick={() => insertSyntax('__', '__')} disabled={isPreview || disabled} />
          <div className="w-px h-4 bg-ink-700 mx-1 max-[520px]:mx-0.5 shrink-0" aria-hidden="true"></div>
          <ToolButton icon={<Quote className="w-4 h-4" />} label="Quote" onClick={() => insertSyntax('\n> ', '')} disabled={isPreview || disabled} />
          <ToolButton icon={<Link2 className="w-4 h-4" />} label="Wiki Link" onClick={handleWikiLink} disabled={isPreview || disabled} />
          <ToolButton icon={<ImageIcon className="w-4 h-4" />} label="Image" onClick={handleImage} disabled={isPreview || disabled} />
        </div>

        {/* Right Side: Preview & Optional Post Button */}
        <div className="flex items-center gap-2 max-[520px]:gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsPreview((prev) => !prev)}
            aria-label={isPreview ? 'Edit' : 'Preview'}
            aria-pressed={isPreview}
            className={`flex items-center gap-2 px-3 py-1 max-[520px]:p-[0.4375rem] max-[520px]:gap-0 rounded text-xs font-bold transition-colors ${isPreview ? 'bg-gold-900/50 text-gold-200 border border-gold-700/50' : 'bg-ink-800 text-ink-400 hover:text-ink-50'}`}
          >
            {isPreview ? <Edit2 className="w-3 h-3 max-[520px]:w-3.5 max-[520px]:h-3.5" aria-hidden="true" /> : <Eye className="w-3 h-3 max-[520px]:w-3.5 max-[520px]:h-3.5" aria-hidden="true" />}
            <span className="max-[520px]:hidden">{isPreview ? 'Edit' : 'Preview'}</span>
          </button>

          {/* INTEGRATED POST BUTTON */}
          {onPost && (
            <button
              type="button"
              onClick={onPost}
              disabled={disabled || isSubmitting || isSubmitDisabled}
              className="flex items-center gap-2 bg-gold-700 hover:bg-gold-600 disabled:bg-ink-800 disabled:text-ink-500 disabled:cursor-not-allowed text-white px-3 py-1 max-[520px]:px-3 max-[520px]:py-1.5 rounded text-xs font-bold whitespace-nowrap"
            >
              {isSubmitting ? <Loader className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Send className="w-3 h-3" aria-hidden="true" />}
              {submitLabel}
            </button>
          )}
        </div>
      </div>

      {/* Editor / Preview Area */}
      <div className="relative w-full bg-ink-950">
        {isPreview ? (
          <div className={`w-full p-4 overflow-y-auto custom-scrollbar bg-ink-900/30 max-w-none ${minHeight} max-h-[500px]`}>
            {value ? <RichText content={value} className="font-serif text-lg leading-[1.55] text-ink-200" onWikiLink={onWikiLink} /> : <span className="text-ink-500 italic">Nothing to preview...</span>}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            aria-label={placeholder}
            className={`w-full bg-ink-950 p-4 text-ink-200 placeholder:text-ink-500 focus:outline-none font-serif text-lg leading-[1.55] resize-none block custom-scrollbar ${minHeight}`}
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
});

export default MarkdownEditor;

function ToolButton({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 max-[520px]:p-1 shrink-0 text-ink-400 hover:text-gold-500 hover:bg-ink-800 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-400"
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}