import { Request as ExpressRequest } from 'express';

export interface CacheOptions {
  ttl?: number;
  keyPrefix?: string;
  
  // HTTP-specific options (only used by route middleware)
  keyGenerator?: (req: ExpressRequest) => string;
  methods?: string[];
  statusCodes?: number[];
  cacheCondition?: (req: ExpressRequest) => boolean;
}

export interface ResultChangePayload {
  schema: string;
  table: string;
  commit_timestamp: string | null;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, any>;
  old: Record<string, any>;
  errors?: string[] | null;
}