import { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check local storage to see if they already accepted
    const accepted = localStorage.getItem('cookies-accepted');
    if (!accepted) {
        // Small delay for smooth entrance
        setTimeout(() => setIsVisible(true), 1000);
    }
  }, []);

  const handleAccept = () => {
      localStorage.setItem('cookies-accepted', 'true');
      setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    // FIX: Changed z-[60] to z-50. 
    // Since this component is rendered last in page.js, it will naturally stack on top 
    // of other z-50 elements (like Chat and Drawer) without needing arbitrary values.
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-slate-900/95 backdrop-blur border border-amber-900/50 p-4 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom-10 flex flex-col gap-3">
        <div className="flex items-start gap-3">
            <div className="p-2 bg-slate-800 rounded-full shrink-0">
                <Cookie className="w-5 h-5 text-amber-500" />
            </div>
            <div>
                <h4 className="font-bold text-white text-sm">Cookie Consent</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    We use essential cookies to ensure you get the best experience on the Realm of Allania (like keeping you logged in).
                </p>
            </div>
            <button onClick={() => setIsVisible(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
            </button>
        </div>
        <div className="flex gap-2 justify-end">
            <button 
                onClick={handleAccept} 
                className="bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded transition-colors w-full md:w-auto"
            >
                Accept & Enter
            </button>
        </div>
    </div>
  );
}