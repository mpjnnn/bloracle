/**
 * @fileoverview Main API service module for mempool.space API integration.
 * Handles rate limiting, caching, retry logic, and error normalization.
 */

import {
  normalizeBlock,
  normalizePoolInfo,
  validateBlock,
  validatePoolInfo,
} from './dataModels.js';

/**
 * @typedef {import('./dataModels.js').PoolBlock} PoolBlock
 * @typedef {import('./dataModels.js').PoolInfo} PoolInfo
 * @typedef {import('./dataModels.js').CacheEntry} CacheEntry
 */

// Constants & Configuration
const BASE_URL = 'https://mempool.space/api/v1';
const RATE_LIMIT_PER_SECOND = 10;
const POOL_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BLOCKS_CACHE_TTL = 1 * 60 * 1000; // 1 minute
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 32000;
const CACHE_PREFIX = 'mempool_api_';

/**
 * Custom error class for API errors
 * @class
 * @extends Error
 */
export class ApiError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} [status] - HTTP status code
   * @param {string} [endpoint] - API endpoint that failed
   * @param {boolean} [retryable=false] - Whether the error is retryable
   */
  constructor(message, status = null, endpoint = null, retryable = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.retryable = retryable;
  }
}

// Rate Limiter Implementation (Token Bucket)
const requestTimestamps = [];

/**
 * Rate limiter using token bucket algorithm
 * @returns {Promise<void>} Resolves when request can proceed
 */
async function waitForRateLimit() {
  while (true) {
    const now = Date.now();
    const oneSecondAgo = now - 1000;

    // Remove timestamps older than 1 second
    while (requestTimestamps.length > 0 && requestTimestamps[0] < oneSecondAgo) {
      requestTimestamps.shift();
    }

    // If we have fewer than RATE_LIMIT_PER_SECOND requests, allow immediately
    if (requestTimestamps.length < RATE_LIMIT_PER_SECOND) {
      requestTimestamps.push(now);
      return;
    }

    // Calculate wait time until oldest request expires
    const oldestTimestamp = requestTimestamps[0];
    const waitTime = 1000 - (now - oldestTimestamp);

    // Wait and then check again
    await new Promise(resolve => setTimeout(resolve, waitTime + 10)); // +10ms buffer
  }
}

// Cache Management Functions

/**
 * Get localStorage if available, otherwise return null
 * @returns {Storage|null} localStorage if available, null otherwise
 */
function getStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

/**
 * Generate unique cache key from endpoint and parameters
 * @param {string} endpoint - API endpoint path
 * @param {Object} [params={}] - Parameters object
 * @returns {string} Cache key
 */
function getCacheKey(endpoint, params = {}) {
  const paramString = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  return `${CACHE_PREFIX}${endpoint}${paramString ? '|' + paramString : ''}`;
}

/**
 * Retrieve cached data if not expired
 * @param {string} key - Cache key
 * @returns {*|null} Cached data or null if expired/missing
 */
function getFromCache(key) {
  const storage = getStorage();
  if (!storage) {
    cacheStats.misses++;
    return null;
  }

  try {
    const cached = storage.getItem(key);
    if (!cached) {
      cacheStats.misses++;
      return null;
    }

    const entry = JSON.parse(cached);
    const now = Date.now();
    const age = now - entry.timestamp;

    if (age >= entry.ttl) {
      // Expired, remove it
      storage.removeItem(key);
      cacheStats.misses++;
      return null;
    }

    cacheStats.hits++;
    return entry.data;
  } catch (error) {
    // Invalid cache entry or localStorage error
    try {
      storage.removeItem(key);
    } catch (e) {
      // Ignore removal errors
    }
    cacheStats.misses++;
    return null;
  }
}

/**
 * Store data in cache with timestamp and TTL
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 * @param {number} ttl - Time-to-live in milliseconds
 */
function setCache(key, data, ttl) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    const entry = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    storage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    // Handle quota exceeded error
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      // Clear expired entries and try again
      clearExpiredCache();
      try {
        const entry = {
          data,
          timestamp: Date.now(),
          ttl,
        };
        storage.setItem(key, JSON.stringify(entry));
      } catch (e) {
        // If still failing, remove oldest entries
        const keys = Object.keys(storage).filter(k => k.startsWith(CACHE_PREFIX));
        if (keys.length > 0) {
          // Remove oldest 10% of entries
          const toRemove = Math.max(1, Math.floor(keys.length * 0.1));
          for (let i = 0; i < toRemove; i++) {
            storage.removeItem(keys[i]);
          }
          // Try one more time
          try {
            const entry = {
              data,
              timestamp: Date.now(),
              ttl,
            };
            storage.setItem(key, JSON.stringify(entry));
          } catch (e2) {
            // Give up, cache is full
            console.warn('Failed to cache data, localStorage quota exceeded');
          }
        }
      }
    }
  }
}

/**
 * Clear all expired cache entries
 */
function clearExpiredCache() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    const keys = Object.keys(storage).filter(k => k.startsWith(CACHE_PREFIX));
    const now = Date.now();

    for (const key of keys) {
      try {
        const cached = storage.getItem(key);
        if (cached) {
          const entry = JSON.parse(cached);
          const age = now - entry.timestamp;
          if (age >= entry.ttl) {
            storage.removeItem(key);
          }
        }
      } catch (e) {
        // Invalid entry, remove it
        storage.removeItem(key);
      }
    }
  } catch (error) {
    // Ignore errors during cleanup
  }
}

// Initialize cache cleanup on module load
if (getStorage()) {
  clearExpiredCache();
}

// Retry Logic with Exponential Backoff

/**
 * Fetch with exponential backoff retry logic
 * @param {string} url - URL to fetch
 * @param {RequestInit} [options={}] - Fetch options
 * @param {number} [retries=MAX_RETRIES] - Number of retries remaining
 * @returns {Promise<Response>} Fetch response
 * @throws {ApiError} If request fails after all retries
 */
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Success
      if (response.ok) {
        return response;
      }

      // Non-retryable errors (except 429)
      if (response.status === 404 || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        throw new ApiError(
          `API error: ${response.status} ${response.statusText}`,
          response.status,
          url,
          false
        );
      }

      // Retryable errors (429, 500, 502, 503, 504)
      if (response.status === 429 || response.status >= 500) {
        if (attempt < retries) {
          const backoffDelay = Math.min(
            INITIAL_BACKOFF_MS * Math.pow(2, attempt),
            MAX_BACKOFF_MS
          );
          // Add jitter (0-20% variation)
          const jitter = backoffDelay * 0.2 * Math.random();
          const delay = backoffDelay + jitter;

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
          throw new ApiError(
            `API error after ${retries + 1} attempts: ${response.status} ${response.statusText}`,
            response.status,
            url,
            true
          );
        }
      }

      // Other status codes - treat as non-retryable
      throw new ApiError(
        `API error: ${response.status} ${response.statusText}`,
        response.status,
        url,
        false
      );
    } catch (error) {
      lastError = error;

      // If it's already an ApiError, rethrow
      if (error instanceof ApiError) {
        throw error;
      }

      // Network errors are retryable
      // Treat any TypeError without an HTTP status as retryable (network-level issues)
      // Also include known DOMException names like NetworkError
      const isNetworkError =
        (error instanceof TypeError && !error.status) ||
        (error instanceof DOMException && error.name === 'NetworkError');

      if (isNetworkError) {
        if (attempt < retries) {
          const backoffDelay = Math.min(
            INITIAL_BACKOFF_MS * Math.pow(2, attempt),
            MAX_BACKOFF_MS
          );
          const jitter = backoffDelay * 0.2 * Math.random();
          const delay = backoffDelay + jitter;

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
          throw new ApiError(
            `Network error after ${retries + 1} attempts: ${error.message}`,
            null,
            url,
            true
          );
        }
      }

      // Other errors - throw immediately
      throw new ApiError(
        `Unexpected error: ${error.message}`,
        null,
        url,
        false
      );
    }
  }

  // Should never reach here, but TypeScript/flow checking
  throw lastError || new ApiError('Unknown error', null, url, false);
}

// Core API Functions

/**
 * Fetch blocks mined by a pool
 * @param {string} poolSlug - Pool identifier (e.g., "innopolistech")
 * @param {number|null} [blockHeight=null] - Optional minimum block height filter
 * @param {Object} [options={}] - Options
 * @param {boolean} [options.forceRefresh=false] - Bypass cache and force refresh
 * @returns {Promise<PoolBlock[]>} Array of block objects
 * @throws {ApiError} If request fails
 */
export async function fetchPoolBlocks(poolSlug, blockHeight = null, options = {}) {
  if (!isValidPoolSlug(poolSlug)) {
    throw new ApiError(`Invalid pool slug: ${poolSlug}`, 400, null, false);
  }

  const endpoint = `/mining/pool/${poolSlug}/blocks${blockHeight ? '/' + blockHeight : ''}`;
  const url = `${BASE_URL}${endpoint}`;
  const cacheKey = getCacheKey(endpoint, { poolSlug, blockHeight });

  // Check cache first
  if (!options.forceRefresh) {
    const cached = getFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // Apply rate limiting
  await waitForRateLimit();

  try {
    const response = await fetchWithRetry(url);
    const data = await response.json();

    // Validate response structure
    if (!Array.isArray(data)) {
      throw new ApiError(
        'Invalid response: expected array of blocks',
        response.status,
        url,
        false
      );
    }

    // Normalize and validate blocks
    const normalizedBlocks = data.map(rawBlock => {
      const normalized = normalizeBlock(rawBlock);
      // Optionally validate - filter invalid entries instead of throwing
      if (!validateBlock(normalized, false)) {
        return null;
      }
      return normalized;
    }).filter(block => block !== null);

    // Store in cache
    setCache(cacheKey, normalizedBlocks, BLOCKS_CACHE_TTL);

    return normalizedBlocks;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Failed to fetch pool blocks: ${error.message}`,
      null,
      url,
      true
    );
  }
}

/**
 * Fetch list of available mining pools
 * @param {string} [timeWindow='1w'] - Time window for pool statistics (e.g., '1w', '1d', '1m')
 * @param {Object} [options={}] - Options
 * @param {boolean} [options.forceRefresh=false] - Bypass cache and force refresh
 * @returns {Promise<Array<{slug: string, name: string, blocksMined: number, hashrateShare: number}>>} Array of pool objects
 * @throws {ApiError} If request fails
 */
export async function fetchAvailablePools(timeWindow = '1w', options = {}) {
  const endpoint = `/mining/pools/${timeWindow}`;
  const url = `${BASE_URL}${endpoint}`;
  const cacheKey = getCacheKey(endpoint, { timeWindow });
  const POOLS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  // Check cache first
  if (!options.forceRefresh) {
    const cached = getFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // Apply rate limiting
  await waitForRateLimit();

  try {
    const response = await fetchWithRetry(url);
    const data = await response.json();

    // Validate response structure - API returns { pools: [...], blockCount: ..., lastEstimatedHashrate: ... }
    if (!data || typeof data !== 'object' || !Array.isArray(data.pools)) {
      throw new ApiError(
        'Invalid response: expected object with pools array',
        response.status,
        url,
        false
      );
    }

    // Normalize pool list - extract slug, name, and key stats from the pools array
    const normalizedPools = data.pools.map(pool => ({
      slug: pool.slug || '',
      name: pool.name || pool.slug || 'Unknown Pool',
      poolId: pool.poolId ?? 0,
      blockCount: pool.blockCount ?? 0,
      rank: pool.rank ?? 0,
      emptyBlocks: pool.emptyBlocks ?? 0,
      link: pool.link || '',
    })).filter(pool => pool.slug); // Filter out pools without slugs

    // Sort by rank (lower is better) or by blockCount
    normalizedPools.sort((a, b) => {
      if (a.rank && b.rank) {
        return a.rank - b.rank;
      }
      return (b.blockCount || 0) - (a.blockCount || 0);
    });

    // Store in cache
    setCache(cacheKey, normalizedPools, POOLS_CACHE_TTL);

    return normalizedPools;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Failed to fetch available pools: ${error.message}`,
      null,
      url,
      true
    );
  }
}

/**
 * Fetch pool information and statistics
 * @param {string} poolSlug - Pool identifier (e.g., "innopolistech")
 * @param {Object} [options={}] - Options
 * @param {boolean} [options.forceRefresh=false] - Bypass cache and force refresh
 * @returns {Promise<PoolInfo>} Pool information object
 * @throws {ApiError} If request fails
 */
export async function fetchPoolInfo(poolSlug, options = {}) {
  if (!isValidPoolSlug(poolSlug)) {
    throw new ApiError(`Invalid pool slug: ${poolSlug}`, 400, null, false);
  }

  const endpoint = `/mining/pool/${poolSlug}`;
  const url = `${BASE_URL}${endpoint}`;
  const cacheKey = getCacheKey(endpoint, { poolSlug });

  // Check cache first
  if (!options.forceRefresh) {
    const cached = getFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // Apply rate limiting
  await waitForRateLimit();

  try {
    const response = await fetchWithRetry(url);
    const data = await response.json();

    console.log('=== fetchPoolInfo Raw API Response ===');
    console.log('URL:', url);
    console.log('Status:', response.status);
    console.log('Raw data:', data);
    console.log('Data keys:', Object.keys(data || {}));
    console.log('Pool object:', data.pool);
    console.log('BlockShare:', data.blockShare);
    console.log('BlockCount:', data.blockCount);
    console.log('=====================================');

    // Validate response structure
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new ApiError(
        'Invalid response: expected pool info object',
        response.status,
        url,
        false
      );
    }

    // Handle nested pool structure - API returns {pool: {...}, blockShare: {...}, blockCount: {...}}
    // Extract pool info from nested structure
    const poolData = data.pool || data;
    
    // Handle blockShare and blockCount which are objects with {all, 24h, 1w}
    const blockShareValue = typeof data.blockShare === 'object' && data.blockShare !== null
      ? (data.blockShare['24h'] || data.blockShare['1w'] || data.blockShare.all || 0)
      : (data.blockShare ?? 0);
    
    const blocksMined24h = typeof data.blockCount === 'object' && data.blockCount !== null
      ? (data.blockCount['24h'] || 0)
      : (data.blocksMined24h ?? 0);
    
    const blocksMined = typeof data.blockCount === 'object' && data.blockCount !== null
      ? (data.blockCount.all || 0)
      : (data.blocksMined ?? 0);

    // Check if pool exists (some pools might not have data)
    if (!poolData.slug && !poolData.name && !data.estimatedHashrate) {
      console.warn('⚠️ Pool data appears to be empty or pool does not exist:', {
        slug: poolSlug,
        rawData: data,
      });
      // Return a minimal valid pool info object
      return {
        id: poolData.id ?? 0,
        name: poolData.name || poolSlug,
        slug: poolData.slug || poolSlug,
        link: poolData.link || '',
        estimatedHashrate: data.estimatedHashrate ?? 0,
        lastEstimatedHashrate: data.lastEstimatedHashrate ?? 0,
        hashrateShare: 0,
        blocksMined: blocksMined,
        blocksMined24h: blocksMined24h,
        blockShare: 0,
        emptyBlocks: data.emptyBlocks ?? 0,
        emptyBlocksShare: 0,
        lastBlockHeight: data.lastBlockHeight ?? 0,
        lastBlockTimestamp: data.lastBlockTimestamp ?? 0,
        rank: data.rank ?? 0,
        hashrateEH: 0,
        hashrateSharePercent: 0,
        blockSharePercent: 0,
      };
    }
    
    // Calculate hashrateShare - use blockShare.24h as proxy if hashrateShare is not available
    // blockShare is a good approximation of hashrateShare for recent periods
    let hashrateShareValue = poolData.hashrateShare ?? data.hashrateShare;
    if (hashrateShareValue === undefined || hashrateShareValue === null) {
      // Use blockShare.24h as proxy for hashrateShare
      hashrateShareValue = blockShareValue;
      console.log('Using blockShare.24h as proxy for hashrateShare:', blockShareValue);
    }
    
    // Create a normalized structure for the normalization function
    const normalizedRawData = {
      ...poolData,
      blockShare: blockShareValue,
      blocksMined: blocksMined,
      blocksMined24h: blocksMined24h,
      estimatedHashrate: data.estimatedHashrate ?? poolData.estimatedHashrate ?? 0,
      lastEstimatedHashrate: data.lastEstimatedHashrate ?? poolData.lastEstimatedHashrate ?? 0,
      hashrateShare: hashrateShareValue,
      emptyBlocks: data.emptyBlocks ?? poolData.emptyBlocks ?? 0,
      emptyBlocksShare: data.emptyBlocksShare ?? poolData.emptyBlocksShare ?? 0,
      lastBlockHeight: data.lastBlockHeight ?? poolData.lastBlockHeight ?? 0,
      lastBlockTimestamp: data.lastBlockTimestamp ?? poolData.lastBlockTimestamp ?? 0,
      rank: data.rank ?? poolData.rank ?? 0,
    };
    
    console.log('Normalized raw data for normalization function:', {
      name: normalizedRawData.name,
      slug: normalizedRawData.slug,
      blockShare: normalizedRawData.blockShare,
      hashrateShare: normalizedRawData.hashrateShare,
      blocksMined24h: normalizedRawData.blocksMined24h,
      estimatedHashrate: normalizedRawData.estimatedHashrate,
    });

    // Normalize and validate pool info
    const normalizedPoolInfo = normalizePoolInfo(normalizedRawData);
    
    console.log('Normalized pool info:', normalizedPoolInfo);
    
    // Debug: Log if hashrateShare is zero to help diagnose issues
    if (normalizedPoolInfo.hashrateShare === 0 && data.hashrateShare !== undefined) {
      console.warn('⚠️ Pool hashrateShare normalized to 0. Raw value:', data.hashrateShare, 'Type:', typeof data.hashrateShare);
    }
    
    if (normalizedPoolInfo.hashrateShare === 0 && normalizedPoolInfo.estimatedHashrate === 0) {
      console.warn('⚠️ Pool has no hashrate data. This pool may not be active or may not exist in the API.');
    }
    
    // Optionally validate - throw if invalid
    validatePoolInfo(normalizedPoolInfo, true);

    // Store in cache
    setCache(cacheKey, normalizedPoolInfo, POOL_INFO_CACHE_TTL);

    return normalizedPoolInfo;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Failed to fetch pool info: ${error.message}`,
      null,
      url,
      true
    );
  }
}

// Utility Functions

/**
 * Basic validation for pool slug format
 * @param {string} slug - Pool slug to validate
 * @returns {boolean} True if valid
 */
export function isValidPoolSlug(slug) {
  if (typeof slug !== 'string' || slug.length === 0) {
    return false;
  }
  // Basic validation: alphanumeric, hyphens, underscores
  return /^[a-zA-Z0-9_-]+$/.test(slug);
}

/**
 * Clear all mempool API cache entries
 */
export function clearAllCache() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    const keys = Object.keys(storage).filter(k => k.startsWith(CACHE_PREFIX));
    for (const key of keys) {
      storage.removeItem(key);
    }
  } catch (error) {
    console.warn('Failed to clear cache:', error);
  }
}

// Cache statistics tracking
let cacheStats = {
  hits: 0,
  misses: 0,
};

/**
 * Get cache hit/miss statistics
 * @returns {{hits: number, misses: number, hitRate: number}} Cache statistics
 */
export function getCacheStats() {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? cacheStats.hits / total : 0;
  return {
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    hitRate,
  };
}


