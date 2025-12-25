'use client';

import { useVersionCheck } from '@/hooks/useVersionCheck';
import { RefreshCw } from 'lucide-react';

export default function VersionUpdater() {
    const { isUpdateAvailable, reloadApp } = useVersionCheck();

    if (!isUpdateAvailable) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-500">
            <div className="bg-amber-900/90 text-amber-100 px-5 py-3 rounded-lg shadow-lg border border-amber-500/30 backdrop-blur-md flex items-center gap-4">
                <div className="flex flex-col">
                    <span className="font-semibold text-sm">Realm Updated</span>
                    <span className="text-xs text-amber-200/80">New chronicles available.</span>
                </div>
                <button
                    onClick={reloadApp}
                    className="bg-amber-500 hover:bg-amber-400 text-amber-950 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                >
                    <RefreshCw className="w-3 h-3" />
                    Reload
                </button>
            </div>
        </div>
    );
}
