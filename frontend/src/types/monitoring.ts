export interface WebhookEvent {
    delivery_id: string;
    event_type: string;
    repo: string;
    action?: string;
    status: 'accepted' | 'ignored' | 'failed' | 'pending';
    reason?: string;
    timestamp: string;
    payload?: any;
}

export interface AnalysisJob {
    job_id: string;
    delivery_id?: string;
    repo: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
    retries: number;
    started_at: string;
    completed_at?: string;
    duration_ms?: number;
    result?: any;
    error?: string;
    progress?: number;
}

export interface MonitoringFilters {
    repo?: string;
    status?: string;
    eventType?: string;
    deliveryId?: string;
    page: number;
    limit: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
