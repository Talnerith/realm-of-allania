import { AllaniaProvider, CharacterDrawer } from 'realm-of-aethelraed';
import { Frame, ClickOnMount, ClickSequence } from '../preview-helpers';

const OPEN = 'Open Character Roster';

const roster = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: `c-${i}`, name: ['Aldric Vane', 'Lyra Moonwhisper', 'Brannock Stoneheart', 'Seraphine Ashdown', 'Thessaly Vane', 'Orrin Gale', 'Kwyn', 'Lady Anne', 'Malik Canlaith', 'Zekiel'][i],
  race: ['Human', 'Elf', 'Dwarf', 'Human', 'Elf', 'Halfling / Gnome', 'Elf', 'Human', 'Human', 'Human'][i],
  class: ['Paladin', 'Wizard / Mage', 'Warrior / Fighter', 'Cleric / Priest', 'Wizard / Mage', 'Bard', 'Alchemist / Tinker', 'Paladin', 'Monk', 'Rogue / Thief'][i],
  imageUrl: '', imagePosition: 'center'
}));

export const Collapsed = () => <Frame height={200}><CharacterDrawer /></Frame>;

export const OpenRoster = () => (
  <Frame height={560}>
    <ClickOnMount label={OPEN}><CharacterDrawer /></ClickOnMount>
  </Frame>
);

export const ThreeCharacters = () => (
  <Frame height={560}>
    <AllaniaProvider characters={roster(3)} activeCharId="c-0">
      <ClickOnMount label={OPEN}><CharacterDrawer /></ClickOnMount>
    </AllaniaProvider>
  </Frame>
);

export const AtLimit = () => (
  <Frame height={560}>
    <AllaniaProvider characters={roster(10)} activeCharId="c-2">
      <ClickOnMount label={OPEN}><CharacterDrawer /></ClickOnMount>
    </AllaniaProvider>
  </Frame>
);

export const NoCharactersYet = () => (
  <Frame height={560}>
    <AllaniaProvider characters={[]}>
      <ClickOnMount label={OPEN}><CharacterDrawer /></ClickOnMount>
    </AllaniaProvider>
  </Frame>
);

export const CreateForm = () => (
  <Frame height={760}>
    <ClickSequence steps={[OPEN, 'New Character']}><CharacterDrawer /></ClickSequence>
  </Frame>
);

export const EditForm = () => (
  <Frame height={760}>
    <ClickSequence steps={[OPEN, 'Edit Aldric Vane']}><CharacterDrawer /></ClickSequence>
  </Frame>
);

export const DeleteConfirm = () => (
  <Frame height={560}>
    <ClickSequence steps={['Delete character', 'Delete']}><CharacterDrawer /></ClickSequence>
  </Frame>
);
