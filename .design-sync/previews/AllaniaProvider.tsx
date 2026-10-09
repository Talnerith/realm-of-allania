import { AllaniaProvider, CharacterListItem, ThemeToggle } from 'realm-of-aethelraed';
import { noop } from '../preview-helpers';

const aldric = { id: 'c-aldric', name: 'Aldric Vane', race: 'Human', class: 'Paladin', imageUrl: '' };

// The same composition under each theme × accent: everything re-colors from the provider
const Sample = ({ theme, accent }: { theme: 'dark' | 'light'; accent: 'gold' | 'ember' | 'brass' | 'verdigris' }) => (
  <AllaniaProvider theme={theme} accent={accent}>
    <div className="w-[420px] p-6 rounded-[14px] bg-ink-950 border border-(color:--card-border) space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[.14em] text-gold-500">{theme} · {accent}</div>
          <h3 className="font-serif text-3xl font-bold text-gold-100">The Ember Oath</h3>
        </div>
        <ThemeToggle />
      </div>
      <div className="rounded-[14px] bg-(color:--card-bg) border border-(color:--card-border) shadow-(--card-shadow) p-5">
        <p className="font-serif text-[1.1875rem] leading-[1.7] text-(color:--story)">
          An order of knights sworn to keep the beacons lit. Members bear the <span className="text-gold-400 font-bold">ember sigil</span>.
        </p>
      </div>
      <CharacterListItem char={aldric} isActive onSelect={noop} onEdit={noop} />
      <div className="flex gap-2">
        <button className="bg-gold-700 hover:bg-gold-600 text-white px-4 py-2 rounded text-sm font-bold">Post Reply</button>
        <button className="border border-ink-700 text-ink-300 hover:text-ink-50 hover:bg-ink-800 px-4 py-2 rounded text-sm">Cancel</button>
      </div>
    </div>
  </AllaniaProvider>
);

export const DarkGold = () => <Sample theme="dark" accent="gold" />;
export const DarkEmber = () => <Sample theme="dark" accent="ember" />;
export const DarkBrass = () => <Sample theme="dark" accent="brass" />;
export const DarkVerdigris = () => <Sample theme="dark" accent="verdigris" />;
export const LightGold = () => <Sample theme="light" accent="gold" />;
export const LightEmber = () => <Sample theme="light" accent="ember" />;
export const LightBrass = () => <Sample theme="light" accent="brass" />;
export const LightVerdigris = () => <Sample theme="light" accent="verdigris" />;
