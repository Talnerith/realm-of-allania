import { AllaniaProvider, WorldMapPage, CharacterDrawer } from 'realm-of-aethelraed';
import { Frame, noop } from '../preview-helpers';

// The whole page scrolls inside its parent; tall frame so the footer shows
export const Page = () => (
  <Frame height={1560}>
    <div className="h-full flex flex-col">
      <WorldMapPage setView={noop} setActiveRegion={noop} onOpenLegal={noop} />
    </div>
    <CharacterDrawer />
  </Frame>
);

export const Light = () => (
  <AllaniaProvider theme="light">
    <Frame height={1560}>
      <div className="h-full flex flex-col">
        <WorldMapPage setView={noop} setActiveRegion={noop} onOpenLegal={noop} />
      </div>
      <CharacterDrawer />
    </Frame>
  </AllaniaProvider>
);
