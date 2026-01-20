/**
 * Network Status Indicator
 * 
 * Shows a banner when the user goes offline.
 */

import { useNetworkStatus } from '@/hooks/use-network-status';
import { WifiOff } from 'lucide-react';

export function NetworkStatusIndicator() {
    const { isOnline } = useNetworkStatus();

    if (isOnline) return null;

    return (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">You're offline. Changes won't be saved.</span>
        </div>
    );
}
