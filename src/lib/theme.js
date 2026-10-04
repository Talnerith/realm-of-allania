// Theme constants shared by ThemeProvider (client) and the root layout's
// pre-paint script (server). See src/context/ThemeContext.js.
export const THEME_STORAGE_KEY = 'allania-theme';
export const THEMES = ['dark', 'light', 'system'];
export const ACCENTS = ['ember', 'brass', 'verdigris'];

// Inline <head> script: applies the saved (or system) theme before first
// paint so light-mode readers never see a dark flash.
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}');if(p!=='dark'&&p!=='light')p=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';var d=document.documentElement;d.setAttribute('data-theme',p);d.setAttribute('data-accent','ember');}catch(e){}})();`;
