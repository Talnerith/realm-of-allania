import { AllaniaProvider, AuthScreen } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

const frame = (children: React.ReactNode) => <div style={{ height: 640 }} className="flex flex-col bg-ink-950">{children}</div>;

export const SignIn = () => frame(
  <AllaniaProvider signedIn={false}><AuthScreen onBack={noop} onLegalClick={noop} /></AllaniaProvider>
);

export const VerifyEmail = () => frame(
  <AllaniaProvider user={{ uid: 'u-new', displayName: 'Newcomer', email: 'newcomer@example.com', emailVerified: false, isAnonymous: false }}>
    <AuthScreen onBack={noop} onLegalClick={noop} />
  </AllaniaProvider>
);
