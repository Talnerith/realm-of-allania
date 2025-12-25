'use client';

import { useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { reloadPage } from '@/lib/navigation';

export default function Error({ error, reset }) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Global Error Boundary Caught:', error);
    }, [error]);

    const isChunkError = error.message.includes('Loading chunk') || error.name === 'ChunkLoadError';

    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-200 p-6 font-serif">
            <div className="max-w-md w-full bg-slate-900/50 border border-slate-800 rounded-lg p-8 shadow-2xl backdrop-blur-sm relative overflow-hidden">

                {/* Decorative Grid Background */}
                <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-900/20 flex items-center justify-center mb-6 border border-amber-900/40 text-amber-500">
                        {isChunkError ? <RefreshCw className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
                    </div>

                    <h2 className="text-2xl font-bold text-amber-500 mb-2 font-display">
                        {isChunkError ? 'Realm Updated' : 'Something went wrong!'}
                    </h2>

                    <p className="text-slate-400 mb-8 leading-relaxed">
                        {isChunkError
                            ? 'A new version of the realm has been deployed. Please reload to sync your chronicles.'
                            : 'The scribes encountered an error recording your actions. We apologize for the interruption.'}
                    </p>

                    <button
                        onClick={
                            // Attempt to recover by trying to re-render the segment
                            // For chunk errors, we force a full reload to get new assets
                            () => isChunkError ? reloadPage() : reset()
                        }
                        className="group relative px-6 py-3 bg-amber-900/40 hover:bg-amber-800/60 border border-amber-700/50 rounded-md transition-all duration-300 overflow-hidden"
                    >
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-amber-500/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        <span className="relative flex items-center gap-2 font-semibold text-amber-200 group-hover:text-amber-100">
                            {isChunkError ? (
                                <>
                                    <RefreshCw className="w-4 h-4" />
                                    Reload Realm
                                </>
                            ) : (
                                'Try Again'
                            )}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
