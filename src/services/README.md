# Services Layer

This directory contains the API service layer that encapsulates all external API interactions and data fetching logic for the mempool.space API integration.

## Overview

The services layer provides a clean, production-ready interface for fetching Bitcoin mining pool data from the mempool.space API. It handles rate limiting, caching, retry logic, and error normalization automatically, allowing UI components to focus on presentation logic.

## Module Descriptions

### `mempoolApi.js`

The main API service module that handles all interactions with the mempool.space API.

**Purpose**: Fetch data from mempool.space API with rate limiting, caching, and retry logic.

**Key Functions**:
- `fetchPoolBlocks(poolSlug, blockHeight, options)` - Fetch blocks mined by a pool
- `fetchPoolInfo(poolSlug, options)` - Fetch pool statistics and information

**Features**:
- **Token bucket rate limiter**: Enforces 10 requests per second limit to prevent 429 errors
- **localStorage caching**: 
  - Pool info cached for 5 minutes (hashrate changes slowly)
  - Block data cached for 1 minute (new blocks are rare but important)
- **Exponential backoff retry**: Automatically retries on transient failures (429, 500, network errors) with exponential backoff (1s → 2s → 4s → fail after 3 attempts)
- **Error handling**: Normalized `ApiError` with `retryable` flag to help UI decide whether to show retry button

**Error Handling**:
- All errors are normalized into `ApiError` instances with:
  - `status`: HTTP status code (if applicable)
  - `message`: Human-readable error message
  - `endpoint`: API endpoint that failed
  - `retryable`: Boolean indicating if error is retryable

### `dataModels.js`

Data models and transformation utilities for API responses.

**Purpose**: Define data structures and provide transformation/validation utilities.

**Key Types** (JSDoc typedefs):
- `PoolBlock`: Complete block object with all fields from API response
- `PoolInfo`: Pool statistics object with hashrate, block counts, shares, rank
- `CacheEntry`: Generic cache wrapper with data, timestamp, ttl
- `PoolExtras`: Nested extras object with pool attribution, coinbase data, fee statistics

**Key Functions**:
- `normalizeBlock(rawBlock)` - Normalize raw API block response, add computed properties (rewardBTC, feesBTC)
- `normalizePoolInfo(rawPoolInfo)` - Normalize raw API pool info, add computed properties (hashrateEH, hashrateSharePercent)
- `validateBlock(block)` - Validate block object structure and data types
- `validatePoolInfo(poolInfo)` - Validate pool info object structure and data types
- `satoshiToBTC(satoshis)` - Convert satoshi amount to BTC
- `formatHashrate(hashrate)` - Convert H/s to human-readable format (EH/s, PH/s, TH/s, etc.)
- `calculateNetworkHashrate(difficulty)` - Calculate network hashrate from difficulty using formula: `H_network ≈ difficulty × 2^32 / 600`

## Usage Examples

### Fetching Pool Blocks

```javascript
import { fetchPoolBlocks } from './services/mempoolApi';

try {
  const blocks = await fetchPoolBlocks('innopolistech');
  console.log(`Fetched ${blocks.length} blocks`);
  blocks.forEach(block => {
    console.log(`Block ${block.height}: ${block.reward} satoshis`);
  });
} catch (error) {
  if (error.retryable) {
    // Show retry button to user
    console.error('Temporary error, user can retry:', error.message);
  } else {
    // Show permanent error message
    console.error('Error fetching blocks:', error.message);
  }
}
```

### Fetching Pool Info

```javascript
import { fetchPoolInfo } from './services/mempoolApi';

try {
  const poolInfo = await fetchPoolInfo('innopolistech');
  console.log(`Pool: ${poolInfo.name}`);
  console.log(`Hashrate: ${poolInfo.estimatedHashrate} H/s`);
  console.log(`Blocks mined (24h): ${poolInfo.blocksMined24h}`);
  console.log(`Hashrate share: ${poolInfo.hashrateShare * 100}%`);
} catch (error) {
  if (error.status === 404) {
    console.error('Pool not found');
  } else {
    console.error('Error fetching pool info:', error.message);
  }
}
```

### Force Refresh (Bypass Cache)

```javascript
import { fetchPoolInfo } from './services/mempoolApi';

// Force fresh data, bypassing cache
const freshData = await fetchPoolInfo('innopolistech', { forceRefresh: true });
```

### Fetching Blocks with Height Filter

```javascript
import { fetchPoolBlocks } from './services/mempoolApi';

// Fetch blocks at or above height 860000
const recentBlocks = await fetchPoolBlocks('innopolistech', 860000);
```

### Using Data Models

```javascript
import { normalizeBlock, satoshiToBTC, formatHashrate } from './services/dataModels';
import { fetchPoolBlocks } from './services/mempoolApi';

const blocks = await fetchPoolBlocks('innopolistech');
const normalized = blocks.map(normalizeBlock);

normalized.forEach(block => {
  console.log(`Block ${block.height}:`);
  console.log(`  Reward: ${block.rewardBTC} BTC`);
  console.log(`  Fees: ${block.feesBTC} BTC`);
  console.log(`  Avg fee rate: ${block.medianFeeRate} sat/vB`);
});
```

## Caching Strategy

The caching system uses browser localStorage for persistence across page reloads:

- **Pool info**: Cached for 5 minutes (hashrate and statistics change slowly)
- **Block data**: Cached for 1 minute (new blocks are rare but important to show quickly)
- **Cache keys**: Include all parameters (poolSlug, blockHeight) to avoid collisions
- **Expiration**: Expired entries are automatically ignored on read and cleaned up periodically
- **Storage management**: Automatically handles localStorage quota errors by clearing old entries

Cache can be manually cleared:

```javascript
import { clearAllCache } from './services/mempoolApi';

// Clear all cached data
clearAllCache();
```

## Rate Limiting

The rate limiter uses a token bucket algorithm to enforce the 10 requests per second limit:

- **Algorithm**: Sliding window tracking request timestamps
- **Automatic queuing**: Requests automatically wait if rate limit is reached
- **Transparent**: Promises resolve when request can proceed, no manual queue management needed
- **Prevents 429 errors**: Ensures we never exceed the API's rate limit

The rate limiter is completely transparent to calling code - you don't need to manage rate limits manually.

## Error Handling

All errors are normalized into `ApiError` instances with consistent structure:

### Retryable Errors
- `429 Too Many Requests`: Rate limit exceeded (handled automatically by rate limiter, but can still occur)
- `500 Internal Server Error`: Server-side error
- `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout`: Transient server errors
- Network errors: Fetch failures, timeouts, etc.

### Non-Retryable Errors
- `404 Not Found`: Pool slug may be invalid or pool has no recent blocks
- `400 Bad Request`: Invalid request parameters
- `403 Forbidden`: Access denied
- Other 4xx errors: Client-side errors

### Exponential Backoff
Retryable errors are automatically retried with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: Wait 1 second + jitter
- Attempt 3: Wait 2 seconds + jitter
- Attempt 4: Wait 4 seconds + jitter
- After 4 attempts: Throw error

Jitter (0-20% random variation) is added to prevent thundering herd problems.

## Testing Considerations

When writing tests for components that use these services:

1. **Mock API calls**: Mock `fetchWithRetry` or the entire `mempoolApi` module to avoid actual API calls
2. **Reset cache**: Use `clearAllCache()` to reset state between tests
3. **Test rate limiter**: Test with rapid sequential calls to verify rate limiting works
4. **Test cache expiration**: Use time mocking to test cache expiration behavior
5. **Test retry logic**: Simulate failures to verify exponential backoff and retry behavior

Example test setup:

```javascript
import { clearAllCache } from './services/mempoolApi';

beforeEach(() => {
  clearAllCache();
  // Mock fetch or mempoolApi functions
});
```

## Future Enhancements

Potential improvements for the services layer:

1. **Request deduplication**: Multiple components requesting same data simultaneously should share the same request
2. **IndexedDB caching**: Use IndexedDB instead of localStorage for larger cache capacity
3. **Request cancellation**: Support AbortController for canceling requests when components unmount
4. **Metrics/telemetry**: Add request metrics (latency, success rate, cache hit rate) for monitoring API health
5. **Batch requests**: Support batch requests if API adds batch endpoints
6. **WebSocket support**: Real-time updates via WebSocket if API supports it
7. **Offline support**: Cache responses for offline access with service worker

## References

- **API Documentation**: See `/docs/API_CONTEXT.md` for detailed API documentation, response structures, and statistical formulas
- **Mempool.space API**: https://mempool.space/docs/api/rest


