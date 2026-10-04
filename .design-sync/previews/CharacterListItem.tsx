import { CharacterListItem } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

const aldric = { id: 'c-aldric', name: 'Aldric Vane', race: 'Human', class: 'Paladin', imageUrl: '', imagePosition: 'center' };
const lyra = { id: 'c-lyra', name: 'Lyra Moonwhisper', race: 'Elf', class: 'Ranger / Hunter', imageUrl: '', imagePosition: 'center' };
const box = (children: React.ReactNode) => <div className="flex flex-col gap-3 w-80 p-4 bg-ink-900 rounded-lg">{children}</div>;

export const Roster = () => box(<>
  <CharacterListItem char={aldric} isActive onSelect={noop} onEdit={noop} />
  <CharacterListItem char={lyra} isActive={false} onSelect={noop} onEdit={noop} />
</>);

export const Active = () => box(<CharacterListItem char={aldric} isActive onSelect={noop} onEdit={noop} />);

export const Inactive = () => box(<CharacterListItem char={lyra} isActive={false} onSelect={noop} onEdit={noop} />);
