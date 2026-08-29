export const generateCacheKey = (key: string, prefix?: string): string => {
  return prefix ? `${prefix}:${key}` : key;
};