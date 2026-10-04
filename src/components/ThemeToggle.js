'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

// Switches between dark and light. Shows the mode it switches TO: icon only
// on small screens, icon + label from md up.
export default function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme();
  const next = theme === 'light' ? 'dark' : 'light';
  const label = next === 'light' ? 'Light mode' : 'Dark mode';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-2 shrink-0 rounded-full border border-(--card-border) px-2.5 py-1.5 md:px-3.5 text-sm text-ink-300 hover:text-ink-50 hover:bg-ink-800 hover:border-ink-700 transition-colors ${className}`}
    >
      {next === 'light' ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
