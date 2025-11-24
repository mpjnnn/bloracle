# Utils Module

This directory contains utility functions for statistical calculations used in the Bitcoin mining pool prediction application.

## Overview

The `poissonCalculations.js` module provides comprehensive statistical functions for analyzing Bitcoin mining pool performance. It implements Poisson and exponential distributions, growth factor adjustments, deviation analysis, and percentile calculations as documented in `/docs/API_CONTEXT.md`.

## Module: poissonCalculations.js

This module implements all statistical formulas documented in the API context documentation. It provides pure functions for:

- **Poisson Distribution**: Probability calculations for block arrivals
- **Exponential Distribution**: Time-to-next-block probability calculations
- **Growth Factor Adjustment**: Adjusting predictions based on observed vs expected performance
- **Deviation Analysis**: Statistical significance testing and p-value calculations
- **Percentile Calculations**: Time and block count percentiles for confidence intervals
- **Probability Curve Generation**: Generating data for visualization
- **High-Level Analysis**: Comprehensive pool performance analysis functions

### Core Concepts

#### Poisson Process for Block Arrivals

Bitcoin block arrivals follow a Poisson process. For a mining pool with block rate λ:

- **Probability of k blocks in time t**: `P(N(t) = k) = (λt)^k × e^(-λt) / k!`
- **Expected blocks**: `E[N(t)] = λt`
- **Standard deviation**: `σ = √(λt)`

#### Exponential Distribution for Time to Next Block

The time T until the next block follows an exponential distribution:

- **Cumulative Distribution**: `P(T ≤ t) = 1 - e^(-λt)`
- **Probability Density**: `f(t) = λ × e^(-λt)`
- **Expected time**: `E[T] = 1/λ`
- **Median time**: `t_median = ln(2)/λ ≈ 0.693/λ`

#### Growth Factor Adjustment Methodology

The growth factor adjusts predictions based on observed performance:

```
growth_factor = observed_blocks / expected_blocks
λ_adjusted = λ_expected / growth_factor
```

- `growth_factor > 1`: Pool is outperforming → adjust predictions upward (longer wait)
- `growth_factor < 1`: Pool is underperforming → adjust predictions downward (shorter wait)
- `growth_factor = Infinity`: Occurs when `expectedBlocks=0` and `observedBlocks>0`. Non-finite growth factors are treated as "no adjustment" by downstream functions, preserving the original expected lambda.

#### Deviation Analysis and Significance Testing

Deviation z-score:
```
z = (observed - expected) / σ
```

P-value for observing k or more blocks:
```
P(N ≥ k) = 1 - P(N ≤ k-1)
```

Deviation is significant if `|z| > z_{α/2}` (typically z ≈ 1.96 for α = 0.05).

## API Reference

### Constants

```javascript
import {
  BLOCK_TIME_SECONDS,      // 600 (average block time)
  BLOCKS_PER_DAY,          // 144 (blocks per day)
  NETWORK_BLOCK_RATE,      // 1/600 blocks/second
  E,                        // Euler's number
  LN_2,                     // Natural log of 2
  Z_SCORES                  // Percentile z-scores (P50, P80, P90, etc.)
} from './poissonCalculations.js';
```

### Poisson Distribution Functions

#### `poissonPMF(k, lambda)`
Probability mass function: probability of exactly k events.

**Parameters:**
- `k` (number): Number of events (non-negative integer)
- `lambda` (number): Rate parameter (expected number of events)

**Returns:** (number) Probability of exactly k events (0 ≤ P ≤ 1)

**Example:**
```javascript
// Probability of exactly 3 blocks when expected rate is 5
const prob = poissonPMF(3, 5); // ≈ 0.1404
```

#### `poissonCDF(k, lambda)`
Cumulative distribution function: probability of k or fewer events.

**Parameters:**
- `k` (number): Number of events
- `lambda` (number): Rate parameter

**Returns:** (number) Probability of k or fewer events

**Example:**
```javascript
// Probability of 5 or fewer blocks
const prob = poissonCDF(5, 5); // ≈ 0.616
```

#### `poissonQuantile(p, lambda)`
Inverse CDF: find the k-th percentile.

**Parameters:**
- `p` (number): Percentile (0 ≤ p ≤ 1)
- `lambda` (number): Rate parameter

**Returns:** (number) Smallest integer k such that P(N ≤ k) ≥ p

**Example:**
```javascript
// 90th percentile
const k90 = poissonQuantile(0.9, 10); // Returns integer k
```

#### `poissonMean(lambda)` / `poissonStdDev(lambda)`
Mean and standard deviation of Poisson distribution.

**Returns:** Mean = λ, Standard deviation = √λ

### Exponential Distribution Functions

#### `exponentialPDF(t, lambda)`
Probability density function: density at time t.

**Parameters:**
- `t` (number): Time in seconds (t ≥ 0)
- `lambda` (number): Rate parameter

**Returns:** (number) Probability density at time t

**Example:**
```javascript
const density = exponentialPDF(3600, 0.0001175);
```

#### `exponentialCDF(t, lambda)`
Cumulative distribution function: probability that next block arrives within t seconds.

**Parameters:**
- `t` (number): Time in seconds
- `lambda` (number): Rate parameter

**Returns:** (number) Probability (0 ≤ P ≤ 1)

**Example:**
```javascript
// Probability next block arrives within 1 hour
const prob = exponentialCDF(3600, 0.0001175); // ≈ 0.35
```

#### `exponentialQuantile(p, lambda)`
Inverse CDF: time at which p-th percentile occurs.

**Parameters:**
- `p` (number): Percentile (0 ≤ p ≤ 1)
- `lambda` (number): Rate parameter

**Returns:** (number) Time in seconds

**Example:**
```javascript
// Median time (50th percentile)
const median = exponentialQuantile(0.5, 0.0001175); // ≈ ln(2)/λ
```

#### `exponentialMean(lambda)` / `exponentialMedian(lambda)`
Mean and median of exponential distribution.

**Returns:** Mean = 1/λ, Median = ln(2)/λ

### Pool Rate Calculations

#### `calculatePoolBlockRate(poolHashrate, networkHashrate)`
Calculate pool block rate from hashrates.

**Parameters:**
- `poolHashrate` (number): Pool hashrate in H/s
- `networkHashrate` (number): Network hashrate in H/s

**Returns:** (number) Pool block rate in blocks/second

**Example:**
```javascript
// Pool: 42.3 EH/s, Network: 600 EH/s
const rate = calculatePoolBlockRate(4.23e19, 6.0e20); // ≈ 0.0001175
```

#### `calculatePoolBlockRateFromShare(hashrateShare)`
Calculate pool block rate from share percentage.

**Parameters:**
- `hashrateShare` (number): Pool share (0-1)

**Returns:** (number) Pool block rate in blocks/second

#### `calculateExpectedBlocks(lambda, timeSeconds)`
Calculate expected number of blocks in time interval.

**Returns:** (number) Expected blocks = λ × t

#### `calculateExpectedTime(lambda)`
Calculate expected time to next block.

**Returns:** (number) Expected time in seconds = 1/λ

### Growth Factor & Adjustment

#### `calculateGrowthFactor(observedBlocks, expectedBlocks)`
Calculate growth factor from observed vs expected.

**Returns:** (number) growth_factor = observed / expected

**Note:** This function can return `Infinity` when `expectedBlocks=0` and `observedBlocks>0`. Non-finite growth factors (including `Infinity`) are treated as "no adjustment" by `adjustLambda()` and related downstream functions, meaning they will use the original expected lambda value without modification.

#### `adjustLambda(lambdaExpected, growthFactor)`
Adjust lambda based on growth factor.

**Returns:** (number) λ_adjusted = λ_expected / growth_factor

#### `calculateAdjustedExpectedTime(lambdaExpected, growthFactor)`
Calculate adjusted expected time.

**Returns:** (number) t_adjusted = (1/λ_expected) × growth_factor

### Deviation Analysis

#### `calculateDeviation(observedBlocks, expectedBlocks, lambda, timeSeconds)`
Calculate deviation z-score.

**Returns:** (number) z = (observed - expected) / σ

#### `calculatePValue(observedBlocks, lambda, timeSeconds)`
Calculate p-value for observing k or more blocks.

**Returns:** (number) P-value (0 ≤ p ≤ 1)

#### `isDeviationSignificant(deviation, alpha)`
Check if deviation is statistically significant.

**Parameters:**
- `deviation` (number): Z-score
- `alpha` (number, optional): Significance level (default 0.05)

**Returns:** (boolean) True if significant

### Percentile & Confidence Interval Functions

#### `calculateTimePercentiles(lambda, percentiles)`
Calculate time percentiles for next block arrival.

**Parameters:**
- `lambda` (number): Block rate
- `percentiles` (number[], optional): Array of percentiles (default [0.5, 0.8, 0.9])

**Returns:** (number[]) Array of time percentiles in seconds

#### `calculateBlockCountPercentiles(lambda, timeSeconds, percentiles)`
Calculate block count percentiles for time interval.

**Returns:** (number[]) Array of block count percentiles

#### `calculateConfidenceInterval(lambda, confidenceLevel)`
Calculate confidence interval for time to next block.

**Returns:** `{lower: number, upper: number}` Confidence interval bounds

### Probability Curve Generation

#### `generateProbabilityCurve(lambda, maxTime, numPoints)`
Generate probability density curve.

**Returns:** `{time: number, probability: number}[]` Array of points

#### `generateCumulativeProbabilityCurve(lambda, maxTime, numPoints)`
Generate cumulative probability curve.

**Returns:** `{time: number, cumulativeProbability: number}[]` Array of points

#### `generateDeviationBands(lambda, maxTime, numPoints, confidenceLevel)`
Generate upper/lower probability bands around the main PDF curve.

The function creates confidence bands that form a tube around the central exponential PDF curve. The bands are generated by evaluating the PDF at lambda values derived from the confidence interval bounds, representing uncertainty in the rate parameter. Unlike truncated curves, these bands extend across the entire time range, providing a continuous visualization of uncertainty around the probability density function.

**Returns:** `{upper: [...], lower: [...]}` Deviation bands forming a tube around the PDF curve

### High-Level Analysis Functions

#### `analyzePoolPerformance(poolInfo, blocks, analysisWindowHours)`
Main analysis function with comprehensive metrics.

**Parameters:**
- `poolInfo` (PoolInfo): Pool information object
- `blocks` (PoolBlock[]): Array of blocks
- `analysisWindowHours` (number, optional): Analysis window (default 24)

**Returns:** Analysis object with all metrics:
```javascript
{
  observedBlocks: number,
  expectedBlocks: number,
  growthFactor: number,
  lambdaExpected: number,
  lambdaAdjusted: number,
  expectedTime: number,
  adjustedExpectedTime: number,
  deviation: number,
  pValue: number,
  isSignificant: boolean,
  timePercentiles: number[],
  blockCountPercentiles: number[]
}
```

#### `calculateNextBlockProbabilities(lambda, timeSinceLastBlock)`
Calculate probabilities for next block within various time windows.

**Returns:**
```javascript
{
  within1h: number,
  within2h: number,
  within4h: number,
  within8h: number,
  within12h: number,
  within24h: number
}
```

#### `generatePredictionData(poolInfo, blocks, currentTime, analysisWindowHours)`
Generate all data needed for UI visualization.

**Parameters:**
- `poolInfo` (PoolInfo): Pool information object
- `blocks` (PoolBlock[]): Array of blocks
- `currentTime` (number, optional): Current time as Unix timestamp in seconds (defaults to now)
- `analysisWindowHours` (number, optional): Analysis window in hours for performance analysis (defaults to 24)

**Returns:** Complete prediction data object with curves, percentiles, statistics, etc.

### Utility Functions

#### `formatProbability(probability)`
Format probability as percentage string.

**Returns:** (string) Formatted percentage (e.g., "45.67%")

#### `formatTimeInterval(seconds)`
Format time interval to human-readable string.

**Returns:** (string) Formatted time (e.g., "2h 15m")

#### `getTimeSinceLastBlock(lastBlockTimestamp, currentTime)`
Calculate elapsed time since last block.

**Returns:** (number) Elapsed time in seconds

#### `getNetworkHashrateFromDifficulty(difficulty)`
Calculate network hashrate from difficulty.

**Formula:** `H_network ≈ difficulty × 2^32 / 600`

**Returns:** (number) Network hashrate in H/s

## Usage Examples

### Example 1: Basic Probability Calculation for a Pool

```javascript
import {
  calculatePoolBlockRateFromShare,
  exponentialCDF,
  exponentialQuantile
} from './poissonCalculations.js';

// Pool has 7.05% of network hashrate
const hashrateShare = 0.0705;
const lambda = calculatePoolBlockRateFromShare(hashrateShare); // ≈ 0.0001175

// Probability next block arrives within 1 hour
const prob1h = exponentialCDF(3600, lambda); // ≈ 0.35

// Median time (50th percentile)
const median = exponentialQuantile(0.5, lambda); // ≈ 5898 seconds (1.64 hours)

console.log(`Probability within 1h: ${(prob1h * 100).toFixed(1)}%`);
console.log(`Median time: ${(median / 3600).toFixed(2)} hours`);
```

### Example 2: Analyzing Pool Performance with Growth Factor

```javascript
import { analyzePoolPerformance } from './poissonCalculations.js';
import { fetchPoolInfo, fetchPoolBlocks } from '../services/mempoolApi.js';

// Fetch pool data
const poolInfo = await fetchPoolInfo('innopolistech');
const blocks = await fetchPoolBlocks('innopolistech');

// Analyze performance
const analysis = analyzePoolPerformance(poolInfo, blocks, 24);

console.log(`Observed blocks (24h): ${analysis.observedBlocks}`);
console.log(`Expected blocks (24h): ${analysis.expectedBlocks.toFixed(2)}`);
console.log(`Growth factor: ${analysis.growthFactor.toFixed(3)}`);
console.log(`Adjusted expected time: ${(analysis.adjustedExpectedTime / 3600).toFixed(2)} hours`);
console.log(`Deviation: ${analysis.deviation.toFixed(2)} std dev`);
console.log(`P-value: ${analysis.pValue.toFixed(4)}`);
console.log(`Significant: ${analysis.isSignificant}`);
```

### Example 3: Generating Probability Curves for Visualization

```javascript
import {
  generatePredictionData,
  formatProbability,
  formatTimeInterval
} from './poissonCalculations.js';

// Generate all prediction data
const data = generatePredictionData(poolInfo, blocks);

// Access probability curves
const probabilityCurve = data.probabilityCurve;
const cumulativeCurve = data.cumulativeCurve;
const deviationBands = data.deviationBands;

// Use with recharts for visualization
// probabilityCurve can be plotted as a line chart
// deviationBands.upper and deviationBands.lower can be plotted as confidence bands

// Access statistics
console.log(`Mean time: ${formatTimeInterval(data.statistics.mean)}`);
console.log(`Median time: ${formatTimeInterval(data.statistics.median)}`);

// Access next block probabilities
Object.entries(data.nextBlockProbabilities).forEach(([window, prob]) => {
  console.log(`${window}: ${formatProbability(prob)}`);
});
```

### Example 4: Calculating Percentiles and Confidence Intervals

```javascript
import {
  calculateTimePercentiles,
  calculateConfidenceInterval,
  formatTimeInterval
} from './poissonCalculations.js';

const lambda = 0.0001175; // Pool block rate

// Calculate time percentiles
const percentiles = calculateTimePercentiles(lambda, [0.5, 0.8, 0.9]);
console.log(`50th percentile: ${formatTimeInterval(percentiles[0])}`);
console.log(`80th percentile: ${formatTimeInterval(percentiles[1])}`);
console.log(`90th percentile: ${formatTimeInterval(percentiles[2])}`);

// Calculate 90% confidence interval
const ci = calculateConfidenceInterval(lambda, 0.9);
console.log(`90% CI: [${formatTimeInterval(ci.lower)}, ${formatTimeInterval(ci.upper)}]`);
```

## Integration with Other Modules

### Using with mempoolApi.js

The calculations module is designed to work seamlessly with data from the API service:

```javascript
import { fetchPoolInfo, fetchPoolBlocks } from '../services/mempoolApi.js';
import { analyzePoolPerformance, generatePredictionData } from './poissonCalculations.js';

// Fetch data
const poolInfo = await fetchPoolInfo('innopolistech');
const blocks = await fetchPoolBlocks('innopolistech');

// Perform analysis
const analysis = analyzePoolPerformance(poolInfo, blocks);
const predictionData = generatePredictionData(poolInfo, blocks);
```

### Data Flow

```
API (mempoolApi.js)
  ↓
Data Models (dataModels.js)
  ↓
Statistical Calculations (poissonCalculations.js)
  ↓
UI Components (future)
```

### Data Structures

The module expects standard `PoolInfo` and `PoolBlock` objects as defined in `/src/services/dataModels.js`:

- **PoolInfo**: Must have `hashrateShare` property (0-1)
- **PoolBlock**: Must have `timestamp` property (Unix timestamp in seconds)

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Test Coverage

The test suite (`poissonCalculations.test.js`) includes:

- **Mathematical Functions**: Factorial, log-factorial, log-gamma
- **Poisson Distribution**: PMF, CDF, quantiles, mean, std dev
- **Exponential Distribution**: PDF, CDF, quantiles, mean, median
- **Pool Rate Calculations**: Block rate calculations from hashrate
- **Growth Factor**: Growth factor and lambda adjustment
- **Deviation Analysis**: Z-scores, p-values, significance testing
- **Percentiles**: Time and block count percentiles
- **Curve Generation**: Probability curve generation
- **Integration**: End-to-end analysis functions
- **Edge Cases**: Zero values, negative values, large values

### Test Utilities

Helper functions for creating test data:

- `createMockPoolInfo(overrides)`: Create mock PoolInfo objects
- `createMockBlocks(count, hoursAgo)`: Create mock PoolBlock arrays
- `integratePDF(pdf, start, end, steps)`: Numerical integration helper

## Mathematical References

### Poisson Distribution

- **Wikipedia**: https://en.wikipedia.org/wiki/Poisson_distribution
- **Formula**: `P(N = k) = (λ^k × e^(-λ)) / k!`
- **Properties**: Mean = λ, Variance = λ, Std Dev = √λ

### Exponential Distribution

- **Wikipedia**: https://en.wikipedia.org/wiki/Exponential_distribution
- **Formula**: `f(t) = λ × e^(-λt)`, `F(t) = 1 - e^(-λt)`
- **Properties**: Mean = 1/λ, Variance = 1/λ², Median = ln(2)/λ
- **Memoryless Property**: `P(T > s+t | T > s) = P(T > t)`

### Bitcoin Mining

- **Bitcoin Mining**: https://en.bitcoin.it/wiki/Mining
- **Difficulty Formula**: `H_network ≈ difficulty × 2^32 / 600`
- **Average Block Time**: 600 seconds (10 minutes)

### API Documentation

- **mempool.space API**: https://mempool.space/docs/api/rest
- **Project API Context**: `/docs/API_CONTEXT.md`

## Performance Considerations

### Memoization

- Factorial calculations use memoization for performance
- Cache is maintained for repeated calls

### Numerical Stability

- Large lambda values (λ ≥ 10) use normal approximation for Poisson quantiles
- Log-space calculations used for numerical stability
- Stirling's approximation used for large factorial calculations

### Approximations

- **Poisson Quantiles**: Normal approximation when λ ≥ 10
- **Log Factorial**: Stirling's approximation for n > 170
- **Normal Quantile**: Beasley-Springer-Moro algorithm approximation

### Optimization Tips

1. **Cache Results**: Store analysis results if pool info hasn't changed
2. **Batch Calculations**: Generate multiple curves in one call
3. **Reduce Points**: Use fewer points in curves for faster generation (default 100-200 points)
4. **Web Workers**: Consider moving heavy calculations to web workers for UI responsiveness

## Future Enhancements

### Potential Optimizations

- **Web Workers**: Offload heavy calculations to background threads
- **SIMD Operations**: Use SIMD for vectorized probability calculations
- **Caching**: Cache expensive calculations (quantiles, percentiles)
- **Lazy Evaluation**: Generate curves on-demand rather than pre-computing

### Additional Statistical Functions

- **Binomial Distribution**: For discrete probability calculations
- **Normal Distribution**: More accurate approximations for large lambda
- **Chi-Square Tests**: Goodness-of-fit testing for distributions
- **Regression Analysis**: Trend analysis for hashrate changes

### Integration Improvements

- **Real-time Updates**: WebSocket integration for live updates
- **Historical Analysis**: Long-term performance tracking
- **Comparative Analysis**: Compare multiple pools
- **Alert System**: Notify on significant deviations

## License

MIT

