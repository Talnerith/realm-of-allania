import { RichText } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

const box = (children: React.ReactNode) => <div className="w-[560px] p-5 bg-ink-900 rounded-lg text-ink-200">{children}</div>;

export const StoryPost = () => box(
  <RichText className="font-serif text-xl leading-relaxed" onWikiLink={noop}
    content={'The smoke rose in a single black thread from beyond the ridge.\n\n"That is no campfire," she murmured. "That is the **old waystation** burning, *and someone wanted it gone*."\n\nShe glanced toward [[Emberfall Keep]].'} />
);

export const Formatting = () => box(
  <RichText onWikiLink={noop}
    content={'**Bold**, *italic* and __underlined__ text.\n\n> A quoted line from the Ember Oath.\n\nLinks to lore: [[The Ember Oath]], [[Silverwood]].\n\n![A map of the ridge](https://example.com/map.png)'} />
);
