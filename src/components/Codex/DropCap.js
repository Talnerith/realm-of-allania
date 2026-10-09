// Ink box of each Pinyon Script capital at 100px, measured with canvas
// measureText: [left of origin, right of origin, ascent, descent]. The
// swashes reach well past the letter's advance width (N and W by ~65%), so a
// ::first-letter box can't fit them; this box scales and centres each letter.
const INK = {
  A: [1, 104, 70, 1], B: [1, 101, 72, 0], C: [-14, 85, 73, 13], D: [1, 99, 69, 0],
  E: [1, 75, 70, 14], F: [1, 110, 78, 0], G: [1, 74, 72, 0], H: [1, 119, 70, 0],
  I: [1, 100, 70, 0], J: [26, 95, 70, 36], K: [1, 129, 72, 0], L: [1, 103, 70, 1],
  M: [1, 125, 74, 0], N: [1, 139, 75, 0], O: [-1, 74, 70, 0], P: [1, 87, 70, 0],
  Q: [1, 88, 70, 14], R: [-1, 92, 70, 0], S: [1, 90, 70, 0], T: [1, 114, 76, 0],
  U: [1, 78, 70, 0], V: [1, 90, 76, 2], W: [1, 147, 72, 2], X: [1, 115, 71, 0],
  Y: [-1, 92, 72, 11], Z: [-1, 88, 70, 2],
};
const FALLBACK = [1, 100, 72, 6];

// The box is a 100x90 viewBox; the ink must fit inside INNER_W x INNER_H
const W = 100, H = 90, INNER_W = 78, INNER_H = 66, MAX_SIZE = 92;

// Font size and origin that centre the letter's ink in the box
export function dropCapLayout(letter) {
  const [left, right, ascent, descent] = INK[letter] || FALLBACK;
  const size = Math.min(MAX_SIZE, (INNER_W * 100) / (left + right), (INNER_H * 100) / (ascent + descent));
  const k = size / 100;
  return {
    size,
    x: W / 2 - ((right - left) / 2) * k,
    y: H / 2 + ((ascent - descent) / 2) * k,
  };
}

// The Codex entry's illuminated first letter, in a gold-framed box. Purely
// decorative: the letter stays in the text (shrunk to nothing there) so
// screen readers, search and copy still get the whole word.
export default function DropCap({ letter }) {
  const char = (letter || '').toUpperCase();
  const { size, x, y } = dropCapLayout(char);
  return (
    <span
      className="float-left mt-1 mr-3.5 mb-1 w-[4.5rem] h-[4.05rem] rounded-sm border border-gold-700 bg-ink-900 text-gold-300"
      aria-hidden="true"
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-full">
        <text x={x} y={y} fontSize={size} fill="currentColor" className="font-script">{char}</text>
      </svg>
    </span>
  );
}
