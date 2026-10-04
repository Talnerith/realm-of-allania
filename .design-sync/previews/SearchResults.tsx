import { SearchResults } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

const frame = (children: React.ReactNode) => <div style={{ height: 640 }} className="flex flex-col bg-ink-950">{children}</div>;

export const Results = () => frame(<SearchResults query="ember" onNavigate={noop} onOpenThread={noop} onOpenCodex={noop} />);

export const NoMatches = () => frame(<SearchResults query="dragonglass" onNavigate={noop} onOpenThread={noop} onOpenCodex={noop} />);
