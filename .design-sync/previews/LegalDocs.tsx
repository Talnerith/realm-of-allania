import { LegalDocs } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

export const Terms = () => <div style={{ height: 720 }} className="flex flex-col bg-ink-950"><LegalDocs goBack={noop} /></div>;
