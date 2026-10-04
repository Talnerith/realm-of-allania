import { ActiveUsers } from 'realm-of-aethelraed';
import { Frame, noop } from '../preview-helpers';

export const Open = () => <Frame height={560}><ActiveUsers isOpen onClose={noop} /></Frame>;
