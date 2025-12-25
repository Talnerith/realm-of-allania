'use client';

import { useEffect, useState } from 'react';

const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

export function useVersionCheck() {
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        let initialBuildId = null;

        const checkVersion = async () => {
            try {
                const res = await fetch('/api/version');
                if (!res.ok) return;
                const data = await res.json();
                const currentBuildId = data.buildId || data.version;

                if (initialBuildId === null) {
                    initialBuildId = currentBuildId;
                } else if (currentBuildId !== initialBuildId) {
                    setIsUpdateAvailable(true);
                    setMsg('A new update is available.');
                }
            } catch (err) {
                console.error('Failed to check version:', err);
            }
        };

        // Initial check to set the baseline
        checkVersion();

        const interval = setInterval(checkVersion, CHECK_INTERVAL);

        // Focus handler to check when user returns to tab
        const onFocus = () => checkVersion();
        window.addEventListener('focus', onFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, []);

    const reloadApp = () => {
        window.location.reload();
    };

    return { isUpdateAvailable, reloadApp };
}
