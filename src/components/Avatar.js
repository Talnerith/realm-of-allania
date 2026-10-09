import { hostedImageUrl } from '@/lib/imageUrls';

// A round portrait in a gold ring over the name's initial, which shows when
// there's no hosted image or it fails to load. Size and text size come from
// `className` (e.g. 'w-10 h-10 text-lg').
export default function Avatar({ name, imageUrl, imagePosition, className = 'w-10 h-10 text-lg' }) {
  const src = hostedImageUrl(imageUrl);
  return (
    <span
      className={`relative rounded-full overflow-hidden bg-ink-800 border border-gold-700 flex items-center justify-center font-serif font-bold text-gold-300 shrink-0 ${className}`}
      aria-hidden="true"
    >
      {(name || '?').charAt(0).toUpperCase()}
      {src && (
        <img
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: imagePosition || 'center' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
    </span>
  );
}
