import { AllaniaProvider, SiteFooter } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

export const Dark = () => <div className="bg-ink-950 pt-16"><SiteFooter onOpenLegal={noop} /></div>;

export const Light = () => <AllaniaProvider theme="light"><div className="bg-ink-950 pt-16"><SiteFooter onOpenLegal={noop} /></div></AllaniaProvider>;
