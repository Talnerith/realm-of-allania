import { CharacterListItem } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

const aldric = { id: 'c-aldric', name: 'Aldric Vane', race: 'Human', class: 'Paladin', imageUrl: '', imagePosition: 'center' };
const lyra = { id: 'c-lyra', name: 'Lyra Moonwhisper', race: 'Elf', class: 'Ranger / Hunter', imageUrl: '', imagePosition: 'center' };
// Cards fill their parent at a 2.2:1 aspect (about 400px wide in the drawer grid)
const box = (children: React.ReactNode) => <div style={{ width: 432 }} className="flex flex-col gap-5 p-4 bg-ink-950">{children}</div>;

export const Roster = () => box(<>
  <CharacterListItem char={aldric} isActive onSelect={noop} onEdit={noop} />
  <CharacterListItem char={lyra} isActive={false} onSelect={noop} onEdit={noop} />
</>);

export const Active = () => box(<CharacterListItem char={aldric} isActive onSelect={noop} onEdit={noop} />);

export const Inactive = () => box(<CharacterListItem char={lyra} isActive={false} onSelect={noop} onEdit={noop} />);
