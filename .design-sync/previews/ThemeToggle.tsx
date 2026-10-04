import { AllaniaProvider, ThemeToggle } from 'realm-of-aethelraed';

const bar = (theme: 'dark' | 'light') => (
  <AllaniaProvider theme={theme}>
    <div className="w-[520px] flex items-center gap-4 px-6 py-4 bg-ink-950 border border-(color:--card-border) rounded-xl">
      <h3 className="font-serif text-2xl text-gold-100">Smoke over the Ember Road</h3>
      <ThemeToggle className="ml-auto" />
    </div>
  </AllaniaProvider>
);

export const InDarkMode = () => bar('dark');
export const InLightMode = () => bar('light');
