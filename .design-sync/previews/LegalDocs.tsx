import { LegalDocs } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

const frame = (children: React.ReactNode) => <div style={{ height: 720 }} className="flex flex-col bg-ink-950">{children}</div>;

export const Terms = () => frame(<LegalDocs goBack={noop} />);

export const CookiePolicy = () => frame(<LegalDocs goBack={noop} initialTab="cookies" />);
