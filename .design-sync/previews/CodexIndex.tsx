import { CodexIndex } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

const frame = (children: React.ReactNode) => <div style={{ height: 640 }} className="flex flex-col bg-ink-950">{children}</div>;

export const Index = () => frame(<CodexIndex onOpenEntry={noop} />);
