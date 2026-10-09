import { tagStyle } from '@/lib/threadTags';

// Colour-coded thread tag. `pill` is the rounded-full style of the thread page.
export default function TagChip({ label, pill = false }) {
  return (
    <span
      className={`border font-semibold ${pill ? 'rounded-full px-3 py-1 text-xs font-medium' : 'rounded px-2 py-0.5 text-xs'}`}
      style={tagStyle(label)}
    >
      {label}
    </span>
  );
}
