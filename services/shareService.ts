
import { ScheduleResult, Service, Staff } from '../types';

interface ShareData {
    result: Partial<ScheduleResult>; // Made partial to allow stripping fields
    services: Service[];
    staff: Staff[];
    year: number;
    month: number;
    generatedAt: string;
}

// Base64 encoding helpers that support UTF-8 characters
const toBase64 = (str: string) => {
    return window.btoa(unescape(encodeURIComponent(str)));
};

const fromBase64 = (str: string) => {
    return decodeURIComponent(escape(window.atob(str)));
};

export const generateShareLink = (
    result: ScheduleResult,
    services: Service[],
    staff: Staff[],
    year: number,
    month: number
): string => {
    // Optimize result to reduce size
    // We remove logs AND stats to drastically reduce URL size.
    // Stats are re-calculated by the viewer/scheduler anyway.
    const optimizedResult: Partial<ScheduleResult> = {
        schedule: result.schedule,
        unfilledSlots: result.unfilledSlots,
        // logs: [], // Removed
        // stats: [] // Removed to save space
    };

    const data: ShareData = {
        result: optimizedResult,
        services,
        staff,
        year,
        month,
        generatedAt: new Date().toISOString()
    };

    const jsonString = JSON.stringify(data);
    const encoded = toBase64(jsonString);
    
    // Use Hash instead of Search Params to avoid "414 Request-URI Too Large"
    // Browsers do not send the fragment (#...) to the server.
    const url = new URL(window.location.href);
    url.search = ''; // Clear any legacy query parameters
    url.hash = `share=${encoded}`;
    
    return url.toString();
};

export const parseShareLink = (): any | null => {
    let shareData: string | null = null;

    // 1. Try to read from Hash (New Method)
    const hash = window.location.hash;
    if (hash && hash.startsWith('#share=')) {
        shareData = hash.substring('#share='.length);
    }
    
    // 2. Fallback to Search Params (Legacy Method)
    if (!shareData) {
        const params = new URLSearchParams(window.location.search);
        shareData = params.get('share');
    }

    if (!shareData) return null;

    try {
        const jsonString = fromBase64(shareData);
        const data = JSON.parse(jsonString);
        
        // Re-construct stats if missing (for older links or optimized links)
        // Basic reconstruction if needed, or UI handles missing stats gracefully
        if (data.result && !data.result.stats && data.staff) {
             // Mock stats or let the UI recalculate. 
             // Ideally the UI should handle missing stats, but we pass empty array to prevent crash
             data.result.stats = [];
             data.result.logs = [];
        }

        return data;
    } catch (e) {
        console.error("Link parsing error:", e);
        return null;
    }
};
