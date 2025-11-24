# API Context Documentation

## 1. Overview

This document serves as the comprehensive reference for the mempool.space API integration and statistical calculations used in the Bitcoin mining pool prediction application.

**Purpose**: Single source of truth for API endpoints, response structures, rate limits, and mathematical formulas for block prediction calculations.

**Official API Documentation**: https://mempool.space/docs/api/rest

## 2. API Endpoints

### 2.1 Pool Blocks Endpoint
**Endpoint**: `GET https://mempool.space/api/v1/mining/pool/{slug}/blocks[/{blockHeight}]`

**Description**: Returns an array of blocks mined by the specified pool, ordered by newest first. Optional blockHeight parameter filters blocks at or above that height.

**Path Parameters**:
- `slug` (string, required): Pool identifier (e.g., "innopolistech", "foundryusa", "antpool")
- `blockHeight` (integer, optional): Minimum block height to filter results

**Response Structure**: Array of block objects with the following fields:
- `id` (string): Block hash
- `height` (integer): Block height in the blockchain
- `version` (integer): Block version number
- `timestamp` (integer): Unix timestamp when block was mined
- `bits` (integer): Difficulty target bits
- `nonce` (integer): Nonce value used to mine the block
- `difficulty` (float): Network difficulty at the time
- `merkleRoot` (string): Merkle root hash
- `tx_count` (integer): Number of transactions in the block
- `size` (integer): Block size in bytes
- `weight` (integer): Block weight (BIP 141)
- `previousblockhash` (string): Hash of the previous block
- `medianTime` (integer): Median time of the last 11 blocks
- `reward` (integer): Block reward in satoshis (subsidy + fees)
- `fees` (integer): Total transaction fees in satoshis
- `extras` (object): Additional metadata
  - `pool` (object): Pool attribution information
    - `id` (integer): Internal pool ID
    - `slug` (string): Pool slug identifier
    - `name` (string): Pool display name
    - `link` (string): Pool website URL (if known)
    - `matched` (boolean): Whether attribution is confident
  - `coinbaseRaw` (string): Raw coinbase transaction hex
  - `coinbaseAddress` (string): Coinbase output address
  - `coinbaseSignature` (string): Pool tag in coinbase
  - `isEmpty` (boolean): Whether block contains only coinbase transaction
  - `avgFeeRate` (float): Average fee rate in sat/vB
  - `avgFee` (integer): Average fee per transaction in satoshis
  - `totalInputs` (integer, optional): Total number of inputs
  - `totalOutputs` (integer, optional): Total number of outputs

**Sample Response**:
```json
[
  {
    "id": "00000000000000000002a7c4c1e48d76c5a37902165a270156b7a8d72728a054",
    "height": 860000,
    "version": 536870912,
    "timestamp": 1730000000,
    "bits": 386089497,
    "nonce": 2847261173,
    "difficulty": 88483843892345.67,
    "merkleRoot": "9abf1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
    "tx_count": 2847,
    "size": 1547892,
    "weight": 3993456,
    "previousblockhash": "00000000000000000001c5d3b2e47d65b4a26801054a160045b6a7d61617a943",
    "medianTime": 1729998500,
    "reward": 637845231,
    "fees": 12845231,
    "extras": {
      "pool": {
        "id": 42,
        "slug": "innopolistech",
        "name": "Innopolistech",
        "link": "https://innopolistech.com",
        "matched": true
      },
      "coinbaseRaw": "03a01d0d...",
      "coinbaseAddress": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      "coinbaseSignature": "/Innopolistech/",
      "isEmpty": false,
      "avgFeeRate": 15.3,
      "avgFee": 4512,
      "totalInputs": 8234,
      "totalOutputs": 5891
    }
  }
]
```

### 2.2 Pool Info Endpoint
**Endpoint**: `GET https://mempool.space/api/v1/mining/pool/{slug}`

**Description**: Returns current statistics and information for the specified mining pool.

**Path Parameters**:
- `slug` (string, required): Pool identifier (e.g., "innopolistech", "foundryusa", "antpool")

**Response Structure**: Single object with the following fields:
- `id` (integer): Internal numeric pool ID
- `name` (string): Pool display name
- `slug` (string): URL slug identifier
- `link` (string): Pool website URL (if known)
- `estimatedHashrate` (float): Current estimated pool hashrate in H/s
- `lastEstimatedHashrate` (float): Previous hashrate estimate for smoothing
- `hashrateShare` (float): Pool share of total network hashrate (0-1)
- `blocksMined` (integer): Total blocks attributed to this pool
- `blocksMined24h` (integer): Blocks mined in the last 24 hours
- `blockShare` (float): Pool share of recent blocks (0-1)
- `emptyBlocks` (integer): Number of empty blocks mined
- `emptyBlocksShare` (float): Share of pool blocks that were empty (0-1)
- `lastBlockHeight` (integer): Most recent block height mined by pool
- `lastBlockTimestamp` (integer): Unix timestamp of last block
- `rank` (integer): Pool rank by hashrate/blocks in recent window

**Sample Response**:
```json
{
  "id": 42,
  "name": "Innopolistech",
  "slug": "innopolistech",
  "link": "https://innopolistech.com",
  "estimatedHashrate": 4.23e19,
  "lastEstimatedHashrate": 4.10e19,
  "hashrateShare": 0.0245,
  "blocksMined": 1247,
  "blocksMined24h": 35,
  "blockShare": 0.0243,
  "emptyBlocks": 3,
  "emptyBlocksShare": 0.0024,
  "lastBlockHeight": 863542,
  "lastBlockTimestamp": 1732000000,
  "rank": 8
}
```

## 3. Rate Limits & Best Practices

**Rate Limits**: The mempool.space public API does not publicly disclose exact rate limits. Based on community guidelines and to ensure reliable service:
- **Conservative guideline**: ~10 requests per second per IP
- **Recommended approach**: Implement exponential backoff on 429 (Too Many Requests) responses
- **Caching**: Use localStorage to cache responses and minimize API calls
- **Polling interval**: For real-time updates, poll every 60 seconds (blocks are mined ~every 10 minutes on average)

**Error Handling**:
- `429 Too Many Requests`: Implement exponential backoff (start with 1s, double on each retry, max 32s)
- `500 Internal Server Error`: Retry with exponential backoff
- `404 Not Found`: Pool slug may be invalid or pool has no recent blocks
- Network errors: Retry with exponential backoff, show user-friendly error message

**Best Practices**:
- Cache pool info for 5-10 minutes (hashrate doesn't change rapidly)
- Cache block data for 1-2 minutes (new blocks are rare)
- Use `If-Modified-Since` headers if supported
- Implement request queuing to respect rate limits
- Show loading states and stale data indicators to users

## 4. Statistical Calculations

### 4.1 Poisson Distribution for Block Prediction

Bitcoin block arrivals follow a **Poisson process**. For a mining pool:

**Pool Block Rate (λ)**:
```
λ_pool = (H_pool / H_network) × λ_network

Where:
- H_pool = pool hashrate (from estimatedHashrate field)
- H_network = total network hashrate
- λ_network = 1 block / 600 seconds ≈ 0.001667 blocks/second
```

**Probability of k blocks in time t**:
```
P(N(t) = k) = (λt)^k × e^(-λt) / k!

Where:
- N(t) = number of blocks found in time t
- k = specific number of blocks (0, 1, 2, ...)
- t = time interval in seconds
- e = Euler's number (2.71828...)
```

**Expected number of blocks in time t**:
```
E[N(t)] = λt
```

### 4.2 Time to Next Block (Exponential Distribution)

The time T until the next block follows an **exponential distribution**:

**Cumulative Distribution Function (CDF)**:
```
P(T ≤ t) = 1 - e^(-λt)

Interpretation: Probability that the next block arrives within t seconds
```

**Probability Density Function (PDF)**:
```
f(t) = λ × e^(-λt), for t ≥ 0

This is the probability curve shown in the main graph
```

**Expected time to next block**:
```
E[T] = 1 / λ

For the network: E[T] = 600 seconds (10 minutes)
For a pool with 2.5% hashrate: E[T] = 600 / 0.025 = 24,000 seconds (6.67 hours)
```

**Median time to next block**:
```
t_median = ln(2) / λ ≈ 0.693 / λ
```

### 4.3 Growth Factor & Adjusted Calculations

The **growth factor** adjusts predictions based on observed vs. expected performance:

**Growth Factor Calculation**:
```
growth_factor = observed_blocks / expected_blocks

Where:
- observed_blocks = actual blocks found in recent period (e.g., last 24h)
- expected_blocks = (H_pool / H_network) × total_network_blocks_in_period

Alternatively using block share:
- expected_blocks = baseline_block_share × total_network_blocks_in_period
```

**Adjusted Block Rate**:
```
λ_adjusted = λ_expected / growth_factor

Interpretation:
- growth_factor > 1: Pool is outperforming (lucky or growing hashrate)
  → λ_adjusted < λ_expected → longer expected time to next block
- growth_factor < 1: Pool is underperforming (unlucky or shrinking hashrate)
  → λ_adjusted > λ_expected → shorter expected time to next block
```

**Adjusted Expected Time**:
```
t_adjusted = 1 / λ_adjusted = (1 / λ_expected) × growth_factor
```

### 4.4 Deviation Analysis

**Standard Deviation of Block Count**:
```
For Poisson distribution with mean λt:
σ = √(λt)

Deviation from expected:
deviation = (observed_blocks - expected_blocks) / σ

Interpretation:
- |deviation| < 1: Within normal range
- |deviation| < 2: Somewhat unusual (95% confidence)
- |deviation| > 2: Statistically significant deviation
```

**Poisson Significance Test**:
```
P-value for observing k or more blocks:
P(N ≥ k) = 1 - Σ(i=0 to k-1) [(λt)^i × e^(-λt) / i!]

If p-value < 0.05: Deviation is statistically significant
```

### 4.5 Percentile Calculations

**For Block Count (Poisson Quantiles)**:

The p-th percentile is the smallest integer x such that P(N ≤ x) ≥ p.

For large λ (λ ≥ 10), approximate using normal distribution:
```
Q_p ≈ λt + z_p × √(λt)

Where z_p is the standard normal quantile:
- z_0.50 = 0 (50th percentile / median)
- z_0.80 ≈ 0.8416 (80th percentile)
- z_0.90 ≈ 1.2816 (90th percentile)

Examples:
- 50th percentile: ≈ λt blocks
- 80th percentile: ≈ λt + 0.84√(λt) blocks
- 90th percentile: ≈ λt + 1.28√(λt) blocks
```

**For Time to Next Block (Exponential Quantiles)**:

The p-th percentile time is:
```
t_p = -ln(1 - p) / λ

Examples:
- 50th percentile (median): t_0.50 = ln(2) / λ ≈ 0.693 / λ
- 80th percentile: t_0.80 = -ln(0.2) / λ ≈ 1.609 / λ
- 90th percentile: t_0.90 = -ln(0.1) / λ ≈ 2.303 / λ

Interpretation:
"There is an 80% probability the next block will arrive within t_0.80 seconds"
```

**Confidence Intervals (Deviation Bands)**:

For a central (1-α) confidence interval:
```
Lower bound: t_L = -ln(1 - α/2) / λ
Upper bound: t_U = -ln(α/2) / λ

For 90% confidence interval (α = 0.10):
- t_L = -ln(0.95) / λ ≈ 0.051 / λ
- t_U = -ln(0.05) / λ ≈ 2.996 / λ

For 95% confidence interval (α = 0.05):
- t_L = -ln(0.975) / λ ≈ 0.025 / λ
- t_U = -ln(0.025) / λ ≈ 3.689 / λ
```

## 5. Implementation Notes

### 5.1 Data Flow
1. Fetch pool info to get current hashrate and block share
2. Fetch recent blocks (last 24-48 hours) to calculate observed performance
3. Calculate expected blocks based on hashrate share
4. Compute growth factor from observed vs. expected
5. Calculate adjusted λ for probability curves
6. Generate probability curves and percentile bands
7. Update UI with real-time countdown and statistics

### 5.2 Time Handling
- All API timestamps are Unix timestamps (seconds since epoch)
- User's current time is UTC+3
- Use `date-fns` library for time calculations and formatting
- Calculate "time since last block" by subtracting last block timestamp from current time
- Calculate "time until next block" using exponential distribution percentiles

### 5.3 Hashrate Conversions
- API returns hashrate in H/s (hashes per second)
- Display conversions:
  - 1 EH/s = 10^18 H/s
  - 1 PH/s = 10^15 H/s
  - 1 TH/s = 10^12 H/s
- Network hashrate can be derived from difficulty:
  ```
  H_network ≈ difficulty × 2^32 / 600
  ```

### 5.4 Currency Conversions
- All reward and fee values in API are in satoshis
- 1 BTC = 100,000,000 satoshis
- Display in BTC: value_btc = value_satoshis / 100000000

## 6. Example Calculations

### Example 1: Basic Pool Prediction

Given:
- Pool hashrate: 4.23 × 10^19 H/s (42.3 EH/s)
- Network hashrate: 6.0 × 10^20 H/s (600 EH/s)
- Pool share: 4.23 × 10^19 / 6.0 × 10^20 = 0.0705 (7.05%)

Calculations:
```
λ_pool = 0.0705 × (1/600) = 0.0001175 blocks/second
Expected time to next block = 1 / 0.0001175 = 8,511 seconds ≈ 2.36 hours

50% probability (median): t_0.50 = 0.693 / 0.0001175 ≈ 5,898 seconds ≈ 1.64 hours
80% probability: t_0.80 = 1.609 / 0.0001175 ≈ 13,694 seconds ≈ 3.80 hours
90% probability: t_0.90 = 2.303 / 0.0001175 ≈ 19,600 seconds ≈ 5.44 hours
```

### Example 2: Growth Factor Adjustment

Given:
- Expected blocks in 24h: 0.0705 × 144 = 10.15 blocks
- Observed blocks in 24h: 12 blocks
- Growth factor: 12 / 10.15 = 1.182

Adjusted calculations:
```
λ_adjusted = 0.0001175 / 1.182 = 0.0000994 blocks/second
Adjusted expected time = 1 / 0.0000994 = 10,060 seconds ≈ 2.79 hours

Interpretation: Pool is performing 18.2% better than expected,
so we adjust the expected time upward (longer wait for next block)
to account for recent luck.
```

### Example 3: Deviation Analysis

Given:
- Expected blocks in 24h: 10.15
- Observed blocks: 12
- Standard deviation: √10.15 ≈ 3.19

Calculations:
```
Deviation = (12 - 10.15) / 3.19 = 0.58 standard deviations

P-value (probability of 12 or more blocks by chance):
Using Poisson CDF with λ = 10.15:
P(N ≥ 12) ≈ 0.32 (32%)

Interpretation: The observed performance is within normal variance
(not statistically significant). The pool is slightly lucky but
this could easily happen by chance.
```

## 7. References

- Mempool.space API: https://mempool.space/docs/api/rest
- Bitcoin Mining: https://en.bitcoin.it/wiki/Mining
- Poisson Process: https://en.wikipedia.org/wiki/Poisson_point_process
- Exponential Distribution: https://en.wikipedia.org/wiki/Exponential_distribution
- Bitcoin Difficulty: https://en.bitcoin.it/wiki/Difficulty


