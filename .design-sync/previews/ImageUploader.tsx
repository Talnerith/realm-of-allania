import { ImageUploader } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

// A stand-in "uploaded" image (inline SVG crest) so each shape's preview & focus area shows
const crest = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">' +
  '<defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#7c3a0a"/><stop offset="1" stop-color="#0b1020"/></radialGradient></defs>' +
  '<rect width="600" height="400" fill="url(#g)"/>' +
  '<path d="M300 90 L360 150 L330 300 L300 320 L270 300 L240 150 Z" fill="none" stroke="#f59e0b" stroke-width="10"/>' +
  '<circle cx="300" cy="190" r="34" fill="#f59e0b"/></svg>'
);
const box = (children: React.ReactNode, width = 320) => <div style={{ width }} className="p-4 bg-ink-900 rounded-lg">{children}</div>;

export const Empty = () => box(<ImageUploader shape="square" folder="codex_gallery" onImageChanged={noop} />);

export const Portrait = () => box(<ImageUploader shape="circle" folder="character_portraits" initialUrl={crest} onImageChanged={noop} />);

export const Banner = () => box(<ImageUploader shape="banner" folder="thread_banners" initialUrl={crest} onImageChanged={noop} />, 560);
