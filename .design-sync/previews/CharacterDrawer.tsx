import { AllaniaProvider, CharacterDrawer } from 'realm-of-aethelraed';
import { Frame, ClickOnMount } from '../preview-helpers';

export const Collapsed = () => <Frame height={200}><CharacterDrawer /></Frame>;

export const OpenRoster = () => (
  <Frame height={560}>
    <ClickOnMount label="Open Character Roster"><CharacterDrawer /></ClickOnMount>
  </Frame>
);

export const NoCharactersYet = () => (
  <Frame height={560}>
    <AllaniaProvider characters={[]}>
      <ClickOnMount label="Open Character Roster"><CharacterDrawer /></ClickOnMount>
    </AllaniaProvider>
  </Frame>
);
