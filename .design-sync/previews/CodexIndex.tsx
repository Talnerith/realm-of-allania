import { AllaniaProvider, CodexIndex } from 'realm-of-aethelraed';
import { ClickSequence, noop } from '../preview-helpers';

const frame = (children: React.ReactNode, height = 1100) => <div style={{ height }} className="flex flex-col bg-ink-950">{children}</div>;

// Hero, then the Characters / Locations / History columns with letter strips and tags
export const Index = () => frame(<CodexIndex onOpenEntry={noop} onRequireAuth={noop} />);

// New Page asks for a title, section and tags, then opens the full editor
export const NewPageForm = () => frame(<ClickSequence steps={['New Page']}><CodexIndex onOpenEntry={noop} onRequireAuth={noop} /></ClickSequence>, 1300);

export const Guest = () => frame(<AllaniaProvider signedIn={false}><CodexIndex onOpenEntry={noop} onRequireAuth={noop} /></AllaniaProvider>);
