/**
 * Error Recovery Utilities
 * 
 * Provides graceful degradation and auto-recovery for common error scenarios.
 */

import { toast } from "@/hooks/use-toast";

/**
 * Error categories for different handling strategies
 */
export type ErrorCategory =
    | "network"      // Network/connectivity issues
    | "auth"         // Authentication/authorization
    | "validation"   // User input validation
    | "server"       // Server-side errors  
    | "ai_service"   // AI service failures
    | "unknown";     // Unclassified errors

/**
 * Categorize an error for appropriate handling
 */
export function categorizeError(error: unknown): ErrorCategory {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();

        // Network errors
        if (message.includes('network') ||
            message.includes('fetch') ||
            message.includes('timeout') ||
            message.includes('failed to fetch')) {
            return "network";
        }

        // Auth errors (401, 403)
        if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
            return "auth";
        }

        // Validation errors (400)
        if (message.includes('400') || message.includes('validation')) {
            return "validation";
        }

        // Server errors (5xx)
        if (message.match(/^5\d\d:/) || message.includes('500') || message.includes('server error')) {
            return "server";
        }

        // AI service errors
        if (message.includes('openai') || message.includes('rate limit') || message.includes('model')) {
            return "ai_service";
        }
    }

    return "unknown";
}

/**
 * Get user-friendly error message based on category
 */
export function getErrorMessage(category: ErrorCategory, original?: string): string {
    switch (category) {
        case "network":
            return "Connection issue. Your changes will sync when back online.";
        case "auth":
            return "Session expired. Please refresh the page to continue.";
        case "validation":
            return original || "Please check your input and try again.";
        case "server":
            return "Server is temporarily unavailable. Retrying automatically...";
        case "ai_service":
            return "AI service is busy. You can continue manually.";
        case "unknown":
        default:
            return original || "Something went wrong. Please try again.";
    }
}

/**
 * Options for error recovery
 */
interface RecoveryOptions {
    showToast?: boolean;
    fallbackValue?: unknown;
    onRecovery?: () => void;
    retryFn?: () => Promise<unknown>;
}

/**
 * Handle an error with appropriate recovery strategy
 */
export async function handleErrorWithRecovery<T>(
    error: unknown,
    options: RecoveryOptions = {}
): Promise<T | null> {
    const { showToast = true, fallbackValue, onRecovery, retryFn } = options;
    const category = categorizeError(error);
    const message = getErrorMessage(category, error instanceof Error ? error.message : undefined);

    // Show user-friendly toast
    if (showToast) {
        toast({
            title: category === "network" ? "Connection Issue" : "Error",
            description: message,
            variant: category === "validation" ? "default" : "destructive",
        });
    }

    // Auto-retry for server errors
    if (category === "server" && retryFn) {
        console.log("[ErrorRecovery] Server error - scheduling retry in 3s");
        setTimeout(async () => {
            try {
                await retryFn();
                onRecovery?.();
            } catch (retryError) {
                console.error("[ErrorRecovery] Retry failed:", retryError);
            }
        }, 3000);
    }

    // For AI service errors, fall back gracefully
    if (category === "ai_service") {
        console.log("[ErrorRecovery] AI service unavailable - using fallback");
    }

    // Return fallback value if provided
    if (fallbackValue !== undefined) {
        return fallbackValue as T;
    }

    return null;
}

/**
 * Wrapper for async functions with built-in error recovery
 */
export function withRecovery<T, Args extends unknown[]>(
    fn: (...args: Args) => Promise<T>,
    fallbackValue: T,
    options?: Omit<RecoveryOptions, "fallbackValue">
): (...args: Args) => Promise<T> {
    return async (...args: Args): Promise<T> => {
        try {
            return await fn(...args);
        } catch (error) {
            const result = await handleErrorWithRecovery<T>(error, {
                ...options,
                fallbackValue,
            });
            return result ?? fallbackValue;
        }
    };
}

/**
 * Check if the app is currently online
 */
export function isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Queue an action to run when back online
 */
const pendingActions: Array<() => Promise<void>> = [];

export function queueWhenOnline(action: () => Promise<void>): void {
    if (isOnline()) {
        action().catch(console.error);
    } else {
        pendingActions.push(action);
    }
}

// Process pending actions when coming back online
if (typeof window !== 'undefined') {
    window.addEventListener('online', async () => {
        console.log(`[ErrorRecovery] Back online - processing ${pendingActions.length} pending actions`);
        const actions = [...pendingActions];
        pendingActions.length = 0;

        for (const action of actions) {
            try {
                await action();
            } catch (error) {
                console.error("[ErrorRecovery] Failed to process pending action:", error);
            }
        }
    });
}
