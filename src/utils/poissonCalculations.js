/**
 * @fileoverview Comprehensive statistical calculation module for Bitcoin mining pool predictions.
 * Implements Poisson and exponential distributions, growth factor adjustments, deviation analysis,
 * and percentile calculations as documented in /docs/API_CONTEXT.md
 */

/**
 * @typedef {import('../services/dataModels.js').PoolInfo} PoolInfo
 * @typedef {import('../services/dataModels.js').PoolBlock} PoolBlock
 */

// ============================================================================
// 1. Constants & Configuration
// ============================================================================

/** Bitcoin network constants */
export const BLOCK_TIME_SECONDS = 600; // Average block time in seconds
export const BLOCKS_PER_DAY = 144; // Blocks per day (86400 / 600)
export const NETWORK_BLOCK_RATE = 1 / BLOCK_TIME_SECONDS; // λ_network ≈ 0.001667 blocks/second

/** Mathematical constants */
export const E = Math.E; // Euler's number ≈ 2.71828
export const LN_2 = Math.LN2; // Natural log of 2 ≈ 0.693

/** Percentile z-scores for normal approximation */
export const Z_SCORES = {
  P50: 0, // 50th percentile (median)
  P80: 0.8416, // 80th percentile
  P90: 1.2816, // 90th percentile
  P95: 1.645, // 95th percentile
  P99: 2.326, // 99th percentile
};

// ============================================================================
// 2. Core Mathematical Functions
// ============================================================================

/** Memoization cache for factorial calculations */
const factorialCache = new Map();

/**
 * Calculate factorial n! = n × (n-1) × ... × 2 × 1
 * Uses memoization for performance. Limited to n ≤ 170 for numerical stability.
 * @param {number} n - Non-negative integer
 * @returns {number} Factorial of n
 * @throws {Error} If n < 0 or n > 170
 */
export function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error(`Factorial is only defined for non-negative integers, got: ${n}`);
  }
  if (n > 170) {
    throw new Error(`Factorial overflow: n > 170 not supported, got: ${n}`);
  }
  if (n === 0 || n === 1) {
    return 1;
  }
  if (factorialCache.has(n)) {
    return factorialCache.get(n);
  }
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  factorialCache.set(n, result);
  return result;
}

/**
 * Calculate natural logarithm of factorial using Stirling's approximation for large n
 * ln(n!) ≈ n×ln(n) - n + (1/2)×ln(2πn) + 1/(12n)
 * @param {number} n - Non-negative integer
 * @returns {number} Natural logarithm of factorial
 */
export function logFactorial(n) {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error(`Log factorial is only defined for non-negative integers, got: ${n}`);
  }
  if (n === 0 || n === 1) {
    return 0;
  }
  if (n <= 170) {
    // Use exact factorial for small n
    return Math.log(factorial(n));
  }
  // Stirling's approximation for large n
  const nLogN = n * Math.log(n);
  const correction = 0.5 * Math.log(2 * Math.PI * n) + 1 / (12 * n);
  return nLogN - n + correction;
}

/**
 * Calculate log-gamma function for continuous factorial approximation
 * Uses Stirling's approximation: ln(Γ(x)) ≈ (x-0.5)×ln(x) - x + 0.5×ln(2π)
 * @param {number} x - Positive real number
 * @returns {number} Natural logarithm of gamma function
 */
export function logGamma(x) {
  if (x <= 0) {
    throw new Error(`Log gamma is only defined for positive numbers, got: ${x}`);
  }
  if (Number.isInteger(x) && x <= 170) {
    return logFactorial(x - 1);
  }
  // Stirling's approximation
  const xLogX = (x - 0.5) * Math.log(x);
  const correction = 0.5 * Math.log(2 * Math.PI);
  return xLogX - x + correction;
}

// ============================================================================
// 3. Poisson Distribution Functions
// ============================================================================

/**
 * Poisson Probability Mass Function: P(N = k) = (λ^k × e^(-λ)) / k!
 * Probability of exactly k events occurring in a fixed interval
 * @param {number} k - Number of events (non-negative integer)
 * @param {number} lambda - Rate parameter (expected number of events)
 * @returns {number} Probability of exactly k events (0 ≤ P ≤ 1)
 */
export function poissonPMF(k, lambda) {
  if (lambda < 0) {
    throw new Error(`Lambda must be non-negative, got: ${lambda}`);
  }
  if (lambda === 0) {
    return k === 0 ? 1 : 0;
  }
  if (k < 0 || !Number.isInteger(k)) {
    return 0;
  }
  // Use log-space calculation for numerical stability
  const logLambda = Math.log(lambda);
  const kLogLambda = k * logLambda;
  const negLambda = -lambda;
  const logKFactorial = logFactorial(k);
  const logPMF = kLogLambda + negLambda - logKFactorial;
  return Math.exp(logPMF);
}

/**
 * Poisson Cumulative Distribution Function: P(N ≤ k) = Σ(i=0 to k) PMF(i)
 * Probability of k or fewer events occurring
 * @param {number} k - Number of events (non-negative integer)
 * @param {number} lambda - Rate parameter
 * @returns {number} Probability of k or fewer events (0 ≤ P ≤ 1)
 */
export function poissonCDF(k, lambda) {
  if (lambda < 0) {
    throw new Error(`Lambda must be non-negative, got: ${lambda}`);
  }
  if (lambda === 0) {
    return 1;
  }
  if (k < 0) {
    return 0;
  }
  if (!Number.isFinite(k)) {
    return 1;
  }
  // Sum PMF values from 0 to k
  let sum = 0;
  for (let i = 0; i <= Math.floor(k); i++) {
    sum += poissonPMF(i, lambda);
  }
  // Ensure result is in [0, 1] due to floating-point errors
  return Math.min(1, Math.max(0, sum));
}

/**
 * Poisson Quantile (Inverse CDF): Find the k-th percentile
 * For large λ (λ ≥ 10), uses normal approximation: Q_p ≈ λ + z_p × √λ
 * @param {number} p - Percentile (0 ≤ p ≤ 1)
 * @param {number} lambda - Rate parameter
 * @returns {number} Smallest integer k such that P(N ≤ k) ≥ p
 */
export function poissonQuantile(p, lambda) {
  if (p < 0 || p > 1) {
    throw new Error(`Percentile must be in [0, 1], got: ${p}`);
  }
  if (lambda < 0) {
    throw new Error(`Lambda must be non-negative, got: ${lambda}`);
  }
  if (lambda === 0) {
    return 0;
  }
  if (p === 0) {
    return 0;
  }
  if (p === 1) {
    return Infinity;
  }
  // Use normal approximation for large lambda
  if (lambda >= 10) {
    // Map p to z-score (inverse standard normal)
    const z = normalQuantile(p);
    const quantile = lambda + z * Math.sqrt(lambda);
    return Math.max(0, Math.ceil(quantile));
  }
  // For small lambda, use binary search on CDF
  let lower = 0;
  let upper = Math.max(10, Math.ceil(lambda * 3)); // Upper bound
  while (upper - lower > 1) {
    const mid = Math.floor((lower + upper) / 2);
    const cdf = poissonCDF(mid, lambda);
    if (cdf >= p) {
      upper = mid;
    } else {
      lower = mid;
    }
  }
  return poissonCDF(lower, lambda) >= p ? lower : upper;
}

/**
 * Approximate inverse standard normal CDF (quantile function)
 * Simple approximation for z-scores
 * @param {number} p - Percentile (0 < p < 1)
 * @returns {number} Z-score
 */
function normalQuantile(p) {
  // Beasley-Springer-Moro algorithm approximation
  const a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

  if (p === 0.5) return 0;
  if (p < 0.5) return -normalQuantile(1 - p);

  const q = p - 0.5;
  if (q < 0.425) {
    const r = 0.180625 - q * q;
    // Evaluate polynomial: a[7]*r^7 + a[6]*r^6 + ... + a[1]*r using Horner's method
    const polyA = (((((a[7] * r + a[6]) * r + a[5]) * r + a[4]) * r + a[3]) * r + a[2]) * r + a[1];
    const numerator = q * polyA;
    // Evaluate polynomial: b[6]*r^6 + b[5]*r^5 + ... + b[1]*r + 1 using Horner's method
    const polyB = (((((b[6] * r + b[5]) * r + b[4]) * r + b[3]) * r + b[2]) * r + b[1]) * r + 1;
    const denominator = polyB;
    return numerator / denominator;
  } else {
    const r = q < 0.925 ? Math.sqrt(-Math.log(0.5 - q)) : Math.sqrt(-Math.log(1 - p));
    // Evaluate polynomial: c[6]*r^6 + c[5]*r^5 + ... + c[1]*r + c[0] using Horner's method
    const polyC = (((((c[6] * r + c[5]) * r + c[4]) * r + c[3]) * r + c[2]) * r + c[1]) * r + c[0];
    const numerator = polyC;
    // Evaluate polynomial: d[4]*r^4 + d[3]*r^3 + ... + d[1]*r + 1 using Horner's method
    const polyD = ((((d[4] * r + d[3]) * r + d[2]) * r + d[1]) * r + 1);
    const denominator = polyD;
    return numerator / denominator;
  }
}

/**
 * Mean of Poisson distribution
 * @param {number} lambda - Rate parameter
 * @returns {number} Mean (E[N] = λ)
 */
export function poissonMean(lambda) {
  return lambda;
}

/**
 * Standard deviation of Poisson distribution
 * @param {number} lambda - Rate parameter
 * @returns {number} Standard deviation (σ = √λ)
 */
export function poissonStdDev(lambda) {
  if (lambda < 0) {
    throw new Error(`Lambda must be non-negative, got: ${lambda}`);
  }
  return Math.sqrt(lambda);
}

// ============================================================================
// 4. Exponential Distribution Functions
// ============================================================================

/**
 * Exponential Probability Density Function: f(t) = λ × e^(-λt)
 * @param {number} t - Time in seconds (t ≥ 0)
 * @param {number} lambda - Rate parameter
 * @returns {number} Probability density at time t
 */
export function exponentialPDF(t, lambda) {
  if (lambda < 0) {
    throw new Error(`Lambda must be non-negative, got: ${lambda}`);
  }
  if (t < 0) {
    return 0;
  }
  if (lambda === 0) {
    return 0;
  }
  return lambda * Math.exp(-lambda * t);
}

/**
 * Exponential Cumulative Distribution Function: P(T ≤ t) = 1 - e^(-λt)
 * Probability that next block arrives within t seconds
 * @param {number} t - Time in seconds (t ≥ 0)
 * @param {number} lambda - Rate parameter
 * @returns {number} Probability (0 ≤ P ≤ 1)
 */
export function exponentialCDF(t, lambda) {
  if (lambda < 0) {
    throw new Error(`Lambda must be non-negative, got: ${lambda}`);
  }
  if (t < 0) {
    return 0;
  }
  if (lambda === 0) {
    return 0;
  }
  return 1 - Math.exp(-lambda * t);
}

/**
 * Exponential Quantile (Inverse CDF): t_p = -ln(1 - p) / λ
 * Time at which p-th percentile of next block arrival occurs
 * @param {number} p - Percentile (0 ≤ p ≤ 1)
 * @param {number} lambda - Rate parameter
 * @returns {number} Time in seconds
 */
export function exponentialQuantile(p, lambda) {
  if (p < 0 || p > 1) {
    throw new Error(`Percentile must be in [0, 1], got: ${p}`);
  }
  if (lambda < 0) {
    throw new Error(`Lambda must be non-negative, got: ${lambda}`);
  }
  if (lambda === 0) {
    return Infinity;
  }
  if (p === 0) {
    return 0;
  }
  if (p === 1) {
    return Infinity;
  }
  return -Math.log(1 - p) / lambda;
}

/**
 * Mean of exponential distribution
 * @param {number} lambda - Rate parameter
 * @returns {number} Mean time (E[T] = 1/λ)
 */
export function exponentialMean(lambda) {
  if (lambda <= 0) {
    throw new Error(`Lambda must be positive for mean calculation, got: ${lambda}`);
  }
  return 1 / lambda;
}

/**
 * Median of exponential distribution
 * @param {number} lambda - Rate parameter
 * @returns {number} Median time (t_median = ln(2)/λ)
 */
export function exponentialMedian(lambda) {
  if (lambda <= 0) {
    throw new Error(`Lambda must be positive for median calculation, got: ${lambda}`);
  }
  return LN_2 / lambda;
}

// ============================================================================
// 5. Pool Rate Calculations
// ============================================================================

/**
 * Calculate pool block rate: λ_pool = (H_pool / H_network) × λ_network
 * @param {number} poolHashrate - Pool hashrate in H/s
 * @param {number} networkHashrate - Network hashrate in H/s
 * @returns {number} Pool block rate in blocks/second
 */
export function calculatePoolBlockRate(poolHashrate, networkHashrate) {
  if (poolHashrate < 0) {
    throw new Error(`Pool hashrate must be non-negative, got: ${poolHashrate}`);
  }
  if (networkHashrate <= 0) {
    throw new Error(`Network hashrate must be positive, got: ${networkHashrate}`);
  }
  if (poolHashrate === 0) {
    return 0;
  }
  const poolShare = poolHashrate / networkHashrate;
  return poolShare * NETWORK_BLOCK_RATE;
}

/**
 * Calculate pool block rate from hashrate share percentage
 * @param {number} hashrateShare - Pool share of network hashrate (0-1)
 * @returns {number} Pool block rate in blocks/second
 */
export function calculatePoolBlockRateFromShare(hashrateShare) {
  if (hashrateShare < 0 || hashrateShare > 1) {
    throw new Error(`Hashrate share must be in [0, 1], got: ${hashrateShare}`);
  }
  return hashrateShare * NETWORK_BLOCK_RATE;
}

/**
 * Calculate expected number of blocks in time interval: E[N(t)] = λ × t
 * @param {number} lambda - Block rate in blocks/second
 * @param {number} timeSeconds - Time interval in seconds
 * @returns {number} Expected number of blocks
 */
export function calculateExpectedBlocks(lambda, timeSeconds) {
  if (lambda < 0) {
    throw new Error(`Lambda must be non-negative, got: ${lambda}`);
  }
  if (timeSeconds < 0) {
    throw new Error(`Time must be non-negative, got: ${timeSeconds}`);
  }
  return lambda * timeSeconds;
}

/**
 * Calculate expected time to next block: E[T] = 1 / λ
 * @param {number} lambda - Block rate in blocks/second
 * @returns {number} Expected time in seconds
 */
export function calculateExpectedTime(lambda) {
  if (lambda <= 0) {
    throw new Error(`Lambda must be positive for expected time, got: ${lambda}`);
  }
  return exponentialMean(lambda);
}

// ============================================================================
// 6. Growth Factor & Adjustment
// ============================================================================

/**
 * Calculate growth factor from observed vs expected blocks
 * growth_factor = observed / expected
 * @param {number} observedBlocks - Actual blocks found
 * @param {number} expectedBlocks - Expected blocks based on hashrate
 * @returns {number} Growth factor (>1 means outperforming, <1 means underperforming).
 *   Can return Infinity when expectedBlocks=0 and observedBlocks>0.
 *   Non-finite values are treated as "no adjustment" by adjustLambda() and related functions.
 */
export function calculateGrowthFactor(observedBlocks, expectedBlocks) {
  if (expectedBlocks === 0) {
    // If no blocks expected, return 1 (no adjustment)
    return observedBlocks === 0 ? 1 : Infinity;
  }
  if (!Number.isFinite(expectedBlocks)) {
    return 1;
  }
  return observedBlocks / expectedBlocks;
}

/**
 * Adjust lambda based on growth factor: λ_adjusted = λ_expected / growth_factor
 * @param {number} lambdaExpected - Expected block rate
 * @param {number} growthFactor - Growth factor from observed performance
 * @returns {number} Adjusted block rate
 */
export function adjustLambda(lambdaExpected, growthFactor) {
  if (lambdaExpected < 0) {
    throw new Error(`Lambda must be non-negative, got: ${lambdaExpected}`);
  }
  if (growthFactor <= 0 || !Number.isFinite(growthFactor)) {
    return lambdaExpected; // No adjustment for invalid growth factor
  }
  return lambdaExpected / growthFactor;
}

/**
 * Calculate adjusted expected time: t_adjusted = (1 / λ_expected) × growth_factor
 * @param {number} lambdaExpected - Expected block rate
 * @param {number} growthFactor - Growth factor
 * @returns {number} Adjusted expected time in seconds
 */
export function calculateAdjustedExpectedTime(lambdaExpected, growthFactor) {
  if (lambdaExpected <= 0) {
    throw new Error(`Lambda must be positive, got: ${lambdaExpected}`);
  }
  if (growthFactor <= 0 || !Number.isFinite(growthFactor)) {
    return calculateExpectedTime(lambdaExpected);
  }
  return (1 / lambdaExpected) * growthFactor;
}

// ============================================================================
// 7. Deviation Analysis
// ============================================================================

/**
 * Calculate deviation z-score: z = (observed - expected) / σ
 * @param {number} observedBlocks - Actual blocks found
 * @param {number} expectedBlocks - Expected blocks
 * @param {number} lambda - Block rate
 * @param {number} timeSeconds - Time interval in seconds
 * @returns {number} Z-score (standard deviations from mean)
 */
export function calculateDeviation(observedBlocks, expectedBlocks, lambda, timeSeconds) {
  if (lambda < 0) {
    throw new Error(`Lambda must be non-negative, got: ${lambda}`);
  }
  if (timeSeconds < 0) {
    throw new Error(`Time must be non-negative, got: ${timeSeconds}`);
  }
  const variance = lambda * timeSeconds;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) {
    return 0; // No variance, so no deviation
  }
  return (observedBlocks - expectedBlocks) / stdDev;
}

/**
 * Calculate p-value for observing k or more blocks
 * P-value = P(N ≥ k) = 1 - P(N < k) = 1 - P(N ≤ k-1)
 * @param {number} observedBlocks - Number of blocks observed (k)
 * @param {number} lambda - Block rate
 * @param {number} timeSeconds - Time interval in seconds
 * @returns {number} P-value (0 ≤ p ≤ 1)
 */
export function calculatePValue(observedBlocks, lambda, timeSeconds) {
  if (lambda < 0) {
    throw new Error(`Lambda must be non-negative, got: ${lambda}`);
  }
  if (timeSeconds < 0) {
    throw new Error(`Time must be non-negative, got: ${timeSeconds}`);
  }
  if (observedBlocks < 0 || !Number.isInteger(observedBlocks)) {
    return 1; // Invalid observation
  }
  const lambdaT = lambda * timeSeconds;
  if (lambdaT === 0) {
    return observedBlocks === 0 ? 1 : 0;
  }
  // P(N ≥ k) = 1 - P(N ≤ k-1)
  const cdf = poissonCDF(observedBlocks - 1, lambdaT);
  return Math.max(0, Math.min(1, 1 - cdf));
}

/**
 * Check if deviation is statistically significant
 * @param {number} deviation - Z-score (absolute deviation in standard deviations)
 * @param {number} [alpha=0.05] - Significance level
 * @returns {boolean} True if deviation is significant
 */
export function isDeviationSignificant(deviation, alpha = 0.05) {
  if (alpha <= 0 || alpha >= 1) {
    throw new Error(`Alpha must be in (0, 1), got: ${alpha}`);
  }
  // Two-tailed test: |z| > z_{α/2}
  // For α = 0.05: z_{0.025} ≈ 1.96
  const zCritical = normalQuantile(1 - alpha / 2);
  return Math.abs(deviation) > zCritical;
}

// ============================================================================
// 8. Percentile & Confidence Interval Functions
// ============================================================================

/**
 * Calculate time percentiles for next block arrival
 * @param {number} lambda - Block rate
 * @param {number[]} [percentiles=[0.5, 0.8, 0.9]] - Array of percentile values (0-1)
 * @returns {number[]} Array of time percentiles in seconds
 */
export function calculateTimePercentiles(lambda, percentiles = [0.5, 0.8, 0.9]) {
  if (lambda <= 0) {
    throw new Error(`Lambda must be positive, got: ${lambda}`);
  }
  return percentiles.map(p => exponentialQuantile(p, lambda));
}

/**
 * Calculate block count percentiles for given time interval
 * @param {number} lambda - Block rate
 * @param {number} timeSeconds - Time interval in seconds
 * @param {number[]} [percentiles=[0.5, 0.8, 0.9]] - Array of percentile values (0-1)
 * @returns {number[]} Array of block count percentiles
 */
export function calculateBlockCountPercentiles(lambda, timeSeconds, percentiles = [0.5, 0.8, 0.9]) {
  if (lambda < 0) {
    throw new Error(`Lambda must be non-negative, got: ${lambda}`);
  }
  if (timeSeconds < 0) {
    throw new Error(`Time must be non-negative, got: ${timeSeconds}`);
  }
  const lambdaT = lambda * timeSeconds;
  return percentiles.map(p => poissonQuantile(p, lambdaT));
}

/**
 * Calculate confidence interval for time to next block
 * @param {number} lambda - Block rate
 * @param {number} [confidenceLevel=0.9] - Confidence level (e.g., 0.9 for 90%)
 * @returns {{lower: number, upper: number}} Confidence interval bounds in seconds
 */
export function calculateConfidenceInterval(lambda, confidenceLevel = 0.9) {
  if (lambda <= 0) {
    throw new Error(`Lambda must be positive, got: ${lambda}`);
  }
  if (confidenceLevel <= 0 || confidenceLevel >= 1) {
    throw new Error(`Confidence level must be in (0, 1), got: ${confidenceLevel}`);
  }
  const alpha = 1 - confidenceLevel;
  const lower = exponentialQuantile(alpha / 2, lambda);
  const upper = exponentialQuantile(1 - alpha / 2, lambda);
  return { lower, upper };
}

// ============================================================================
// 9. Probability Curve Generation
// ============================================================================

/**
 * Generate probability density curve for exponential distribution
 * @param {number} lambda - Block rate
 * @param {number} maxTime - Maximum time in seconds
 * @param {number} [numPoints=100] - Number of points to generate
 * @returns {{time: number, probability: number}[]} Array of {time, probability} points
 */
export function generateProbabilityCurve(lambda, maxTime, numPoints = 100) {
  if (lambda <= 0) {
    throw new Error(`Lambda must be positive, got: ${lambda}`);
  }
  if (maxTime <= 0) {
    throw new Error(`Max time must be positive, got: ${maxTime}`);
  }
  const points = [];
  const step = maxTime / numPoints;
  for (let i = 0; i <= numPoints; i++) {
    const time = i * step;
    const probability = exponentialPDF(time, lambda);
    points.push({ time, probability });
  }
  return points;
}

/**
 * Generate cumulative probability curve for exponential distribution
 * @param {number} lambda - Block rate
 * @param {number} maxTime - Maximum time in seconds
 * @param {number} [numPoints=100] - Number of points to generate
 * @returns {{time: number, cumulativeProbability: number}[]} Array of {time, cumulativeProbability} points
 */
export function generateCumulativeProbabilityCurve(lambda, maxTime, numPoints = 100) {
  if (lambda <= 0) {
    throw new Error(`Lambda must be positive, got: ${lambda}`);
  }
  if (maxTime <= 0) {
    throw new Error(`Max time must be positive, got: ${maxTime}`);
  }
  const points = [];
  const step = maxTime / numPoints;
  for (let i = 0; i <= numPoints; i++) {
    const time = i * step;
    const cumulativeProbability = exponentialCDF(time, lambda);
    points.push({ time, cumulativeProbability });
  }
  return points;
}

/**
 * Generate deviation bands (confidence intervals) around probability curve
 * Creates bands around the main PDF curve by using lambda values adjusted based on confidence intervals.
 * The bands represent uncertainty in the PDF itself, forming a tube around the central curve.
 * @param {number} lambda - Block rate
 * @param {number} maxTime - Maximum time in seconds
 * @param {number} [numPoints=100] - Number of points to generate
 * @param {number} [confidenceLevel=0.9] - Confidence level for bands
 * @returns {{upper: {time: number, probability: number}[], lower: {time: number, probability: number}[]}} Upper and lower probability bands
 */
export function generateDeviationBands(lambda, maxTime, numPoints = 100, confidenceLevel = 0.9) {
  if (lambda <= 0) {
    throw new Error(`Lambda must be positive, got: ${lambda}`);
  }
  if (maxTime <= 0) {
    throw new Error(`Max time must be positive, got: ${maxTime}`);
  }
  // Get confidence interval for time to derive lambda scaling factors
  const { lower: lowerTime, upper: upperTime } = calculateConfidenceInterval(lambda, confidenceLevel);
  // Derive lambda bounds: use the ratio of expected time to CI bounds
  // This creates bands that show what the PDF would look like at different rates
  const expectedTime = 1 / lambda;
  // Lambda for upper time bound (slower rate): λ_upper = 1/t_U
  // Lambda for lower time bound (faster rate): λ_lower = 1/t_L
  const lambdaUpper = 1 / upperTime; // Slower rate (longer wait)
  const lambdaLower = 1 / lowerTime; // Faster rate (shorter wait)
  const step = maxTime / numPoints;
  const upper = [];
  const lower = [];
  for (let i = 0; i <= numPoints; i++) {
    const time = i * step;
    // Upper band: PDF at slower rate (lambdaUpper) - higher PDF at early times
    // Lower band: PDF at faster rate (lambdaLower) - lower PDF at early times
    const upperProb = exponentialPDF(time, lambdaUpper);
    const lowerProb = exponentialPDF(time, lambdaLower);
    upper.push({ time, probability: upperProb });
    lower.push({ time, probability: lowerProb });
  }
  return { upper, lower };
}

// ============================================================================
// 10. High-Level Analysis Functions
// ============================================================================

/**
 * Analyze pool performance with comprehensive metrics
 * @param {PoolBlock[]} blocks - Array of blocks mined by pool
 * @param {PoolInfo} poolInfo - Pool information object
 * @param {number} [analysisWindowHours=24] - Analysis window in hours
 * @returns {{
 *   observedBlocks: number,
 *   expectedBlocks: number,
 *   growthFactor: number,
 *   lambdaExpected: number,
 *   lambdaAdjusted: number,
 *   expectedTime: number,
 *   adjustedExpectedTime: number,
 *   deviation: number,
 *   pValue: number,
 *   isSignificant: boolean,
 *   timePercentiles: number[],
 *   blockCountPercentiles: number[]
 * }} Analysis results object
 */
export function analyzePoolPerformance(blocks, poolInfo, analysisWindowHours = 24) {
  if (!poolInfo) {
    throw new Error('Invalid pool info: poolInfo is required');
  }
  if (typeof poolInfo.hashrateShare !== 'number' || isNaN(poolInfo.hashrateShare)) {
    throw new Error(`Invalid pool info: hashrateShare must be a number, got: ${poolInfo.hashrateShare} (${typeof poolInfo.hashrateShare})`);
  }
  if (!Array.isArray(blocks)) {
    throw new Error('Blocks must be an array');
  }
  const analysisWindowSeconds = analysisWindowHours * 3600;
  const currentTime = Math.floor(Date.now() / 1000);
  const windowStartTime = currentTime - analysisWindowSeconds;
  
  console.log('=== analyzePoolPerformance Debug ===');
  console.log('Inputs:', {
    blocksCount: blocks.length,
    poolInfoHashrateShare: poolInfo.hashrateShare,
    analysisWindowHours,
    currentTime,
    windowStartTime,
  });
  
  // Filter blocks within analysis window
  const blocksInWindow = blocks.filter(block => block.timestamp >= windowStartTime);
  const observedBlocks = blocksInWindow.length;
  console.log('Blocks in window:', {
    totalBlocks: blocks.length,
    blocksInWindow: blocksInWindow.length,
    observedBlocks,
    windowStartTime: new Date(windowStartTime * 1000).toISOString(),
    currentTime: new Date(currentTime * 1000).toISOString(),
  });
  
  // Calculate expected blocks based on hashrate share
  const expectedBlocksInWindow = poolInfo.hashrateShare * BLOCKS_PER_DAY * (analysisWindowHours / 24);
  const expectedBlocks = expectedBlocksInWindow;
  console.log('Expected blocks calculation:', {
    hashrateShare: poolInfo.hashrateShare,
    BLOCKS_PER_DAY,
    analysisWindowHours,
    expectedBlocks,
  });
  
  // Calculate lambda from hashrate share
  const lambdaExpected = calculatePoolBlockRateFromShare(poolInfo.hashrateShare);
  console.log('Lambda calculation:', {
    hashrateShare: poolInfo.hashrateShare,
    NETWORK_BLOCK_RATE,
    lambdaExpected,
  });
  
  // Calculate growth factor
  const growthFactor = calculateGrowthFactor(observedBlocks, expectedBlocks);
  console.log('Growth factor:', {
    observedBlocks,
    expectedBlocks,
    growthFactor,
  });
  
  // Calculate adjusted lambda
  const lambdaAdjusted = adjustLambda(lambdaExpected, growthFactor);
  console.log('Adjusted lambda:', {
    lambdaExpected,
    growthFactor,
    lambdaAdjusted,
  });
  
  // Handle zero lambda case (pool has no hashrate)
  if (lambdaExpected <= 0) {
    console.warn('⚠️ ZERO LAMBDA DETECTED! Returning Infinity values', {
      lambdaExpected,
      hashrateShare: poolInfo.hashrateShare,
    });
    // Return default values for pools with no hashrate
    return {
      observedBlocks,
      expectedBlocks,
      growthFactor: 1,
      lambdaExpected: 0,
      lambdaAdjusted: 0,
      expectedTime: Infinity,
      adjustedExpectedTime: Infinity,
      deviation: {
        zScore: 0,
        pValue: 1,
      },
      isSignificant: false,
      timePercentiles: [Infinity, Infinity, Infinity],
      blockCountPercentiles: [0, 0, 0],
    };
  }
  
  // Calculate expected times
  const expectedTime = calculateExpectedTime(lambdaExpected);
  const adjustedExpectedTime = calculateAdjustedExpectedTime(lambdaExpected, growthFactor);
  console.log('Expected times:', {
    expectedTime,
    adjustedExpectedTime,
    expectedTimeHours: expectedTime / 3600,
    adjustedExpectedTimeHours: adjustedExpectedTime / 3600,
  });
  
  // Calculate deviation and p-value
  const deviationZScore = calculateDeviation(observedBlocks, expectedBlocks, lambdaExpected, analysisWindowSeconds);
  const pValue = calculatePValue(observedBlocks, lambdaExpected, analysisWindowSeconds);
  const isSignificant = isDeviationSignificant(deviationZScore);
  console.log('Deviation analysis:', {
    deviationZScore,
    pValue,
    isSignificant,
  });
  
  // Calculate percentiles (use lambdaAdjusted if > 0, otherwise use lambdaExpected)
  const lambdaForPercentiles = lambdaAdjusted > 0 ? lambdaAdjusted : lambdaExpected;
  const timePercentiles = calculateTimePercentiles(lambdaForPercentiles, [0.5, 0.8, 0.9]);
  const blockCountPercentiles = calculateBlockCountPercentiles(lambdaForPercentiles, analysisWindowSeconds, [0.5, 0.8, 0.9]);
  console.log('Percentiles:', {
    lambdaForPercentiles,
    timePercentiles,
    blockCountPercentiles,
  });
  const result = {
    observedBlocks,
    expectedBlocks,
    growthFactor,
    lambdaExpected,
    lambdaAdjusted,
    expectedTime,
    adjustedExpectedTime,
    deviation: {
      zScore: deviationZScore,
      pValue: pValue,
    },
    isSignificant,
    timePercentiles,
    blockCountPercentiles,
  };
  
  console.log('Final analysis result:', result);
  console.log('================================');
  
  return result;
}

/**
 * Calculate probabilities for next block within various time windows
 * @param {number} lambda - Block rate
 * @param {number} timeSinceLastBlock - Time since last block in seconds
 * @returns {{
 *   within1h: number,
 *   within2h: number,
 *   within4h: number,
 *   within8h: number,
 *   within12h: number,
 *   within24h: number
 * }} Probabilities for each time window
 */
export function calculateNextBlockProbabilities(lambda, timeSinceLastBlock) {
  if (lambda <= 0) {
    throw new Error(`Lambda must be positive, got: ${lambda}`);
  }
  if (timeSinceLastBlock < 0) {
    throw new Error(`Time since last block must be non-negative, got: ${timeSinceLastBlock}`);
  }
  // Due to memoryless property: P(T ≤ t | T > s) = P(T ≤ t-s)
  // Probability within next hour = P(T ≤ timeSinceLastBlock + 3600) - P(T ≤ timeSinceLastBlock)
  const windows = [
    { name: 'within1h', seconds: 3600 },
    { name: 'within2h', seconds: 7200 },
    { name: 'within4h', seconds: 14400 },
    { name: 'within8h', seconds: 28800 },
    { name: 'within12h', seconds: 43200 },
    { name: 'within24h', seconds: 86400 },
  ];
  const result = {};
  for (const window of windows) {
    const totalTime = timeSinceLastBlock + window.seconds;
    const probTotal = exponentialCDF(totalTime, lambda);
    const probAlready = exponentialCDF(timeSinceLastBlock, lambda);
    // Conditional probability: P(T ≤ total | T > since) = (P(total) - P(since)) / (1 - P(since))
    const probConditional = probAlready === 1 ? 1 : (probTotal - probAlready) / (1 - probAlready);
    result[window.name] = Math.max(0, Math.min(1, probConditional));
  }
  return result;
}

/**
 * Generate all data needed for UI visualization
 * @param {PoolBlock[]} blocks - Array of blocks
 * @param {PoolInfo} poolInfo - Pool information
 * @param {number} [currentTime] - Current time (Unix timestamp, defaults to now)
 * @param {number} [analysisWindowHours=24] - Analysis window in hours for performance analysis
 * @returns {{
 *   analysis: ReturnType<typeof analyzePoolPerformance>,
 *   probabilityCurve: ReturnType<typeof generateProbabilityCurve>,
 *   cumulativeCurve: ReturnType<typeof generateCumulativeProbabilityCurve>,
 *   deviationBands: ReturnType<typeof generateDeviationBands>,
 *   nextBlockProbabilities: ReturnType<typeof calculateNextBlockProbabilities>,
 *   timeSinceLastBlock: number,
 *   statistics: {
 *     mean: number,
 *     median: number,
 *     stdDev: number,
 *     confidenceInterval: {lower: number, upper: number}
 *   }
 * }} Complete prediction data object
 */
export function generatePredictionData(blocks, poolInfo, currentTime = Math.floor(Date.now() / 1000), analysisWindowHours = 24) {
  if (!poolInfo || typeof poolInfo.hashrateShare !== 'number') {
    throw new Error('Invalid pool info: hashrateShare required');
  }
  if (!Array.isArray(blocks)) {
    throw new Error('Blocks must be an array');
  }
  console.log('=== generatePredictionData Debug ===');
  console.log('Inputs:', {
    blocksCount: blocks.length,
    poolInfo: {
      name: poolInfo.name,
      hashrateShare: poolInfo.hashrateShare,
      estimatedHashrate: poolInfo.estimatedHashrate,
    },
    currentTime,
    analysisWindowHours,
  });
  
  // Analyze performance
  const analysis = analyzePoolPerformance(blocks, poolInfo, analysisWindowHours);
  console.log('Analysis result:', analysis);
  
  // Use adjusted lambda for predictions
  const lambda = analysis.lambdaAdjusted > 0 ? analysis.lambdaAdjusted : analysis.lambdaExpected;
  console.log('Lambda for predictions:', {
    lambdaAdjusted: analysis.lambdaAdjusted,
    lambdaExpected: analysis.lambdaExpected,
    selectedLambda: lambda,
  });
  
  // Handle zero lambda case (pool has no hashrate)
  if (lambda <= 0) {
    console.warn('⚠️ ZERO LAMBDA in generatePredictionData! Returning empty curves', { lambda });
    // Return default values for pools with no hashrate
    const lastBlockTimestamp = poolInfo.lastBlockTimestamp || (blocks.length > 0 ? Math.max(...blocks.map(b => b.timestamp)) : 0);
    const timeSinceLastBlock = getTimeSinceLastBlock(lastBlockTimestamp, currentTime);
    return {
      analysis,
      probabilityCurve: [],
      cumulativeCurve: [],
      deviationBands: { upper: [], lower: [] },
      nextBlockProbabilities: {
        within1h: 0,
        within2h: 0,
        within4h: 0,
        within8h: 0,
        within12h: 0,
        within24h: 0,
      },
      timeSinceLastBlock,
      statistics: {
        mean: Infinity,
        median: Infinity,
        stdDev: Infinity,
        confidenceInterval: { lower: Infinity, upper: Infinity },
      },
    };
  }
  
  // Calculate time since last block
  const lastBlockTimestamp = poolInfo.lastBlockTimestamp || (blocks.length > 0 ? Math.max(...blocks.map(b => b.timestamp)) : 0);
  const timeSinceLastBlock = getTimeSinceLastBlock(lastBlockTimestamp, currentTime);
  console.log('Time since last block:', {
    lastBlockTimestamp,
    currentTime,
    timeSinceLastBlock,
    lastBlockTimestampDate: lastBlockTimestamp ? new Date(lastBlockTimestamp * 1000).toISOString() : 'N/A',
  });
  
  // Generate curves (use 4x expected time as max for visualization)
  const maxTime = Math.max(analysis.adjustedExpectedTime * 4, 86400); // At least 24 hours
  console.log('Curve generation params:', {
    lambda,
    maxTime,
    maxTimeHours: maxTime / 3600,
    adjustedExpectedTime: analysis.adjustedExpectedTime,
  });
  
  const probabilityCurve = generateProbabilityCurve(lambda, maxTime, 200);
  console.log('Probability curve generated:', {
    length: probabilityCurve.length,
    firstPoint: probabilityCurve[0],
    lastPoint: probabilityCurve[probabilityCurve.length - 1],
    samplePoints: probabilityCurve.slice(0, 5),
  });
  
  const cumulativeCurve = generateCumulativeProbabilityCurve(lambda, maxTime, 200);
  console.log('Cumulative curve generated:', {
    length: cumulativeCurve.length,
    firstPoint: cumulativeCurve[0],
    lastPoint: cumulativeCurve[cumulativeCurve.length - 1],
  });
  
  const deviationBands = generateDeviationBands(lambda, maxTime, 200, 0.9);
  console.log('Deviation bands generated:', {
    upperLength: deviationBands.upper.length,
    lowerLength: deviationBands.lower.length,
  });
  
  // Calculate next block probabilities
  const nextBlockProbabilities = calculateNextBlockProbabilities(lambda, timeSinceLastBlock);
  console.log('Next block probabilities:', nextBlockProbabilities);
  
  // Calculate statistics
  const mean = exponentialMean(lambda);
  const median = exponentialMedian(lambda);
  const stdDev = Math.sqrt(1 / (lambda * lambda)); // Standard deviation of exponential = 1/λ
  const confidenceInterval = calculateConfidenceInterval(lambda, 0.9);
  console.log('Statistics:', {
    mean,
    median,
    stdDev,
    confidenceInterval,
  });
  const result = {
    analysis,
    probabilityCurve,
    cumulativeCurve,
    deviationBands,
    nextBlockProbabilities,
    timeSinceLastBlock,
    statistics: {
      mean,
      median,
      stdDev,
      confidenceInterval,
    },
  };
  
  console.log('Final prediction data result:', {
    analysisKeys: Object.keys(analysis),
    probabilityCurveLength: result.probabilityCurve.length,
    cumulativeCurveLength: result.cumulativeCurve.length,
    nextBlockProbabilities: result.nextBlockProbabilities,
  });
  console.log('====================================');
  
  return result;
}

// ============================================================================
// 11. Utility Functions
// ============================================================================

/**
 * Format probability as percentage string
 * @param {number} probability - Probability value (0-1)
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {string} Formatted percentage (e.g., "45.67%")
 */
export function formatProbability(probability) {
  if (!Number.isFinite(probability)) {
    return '0%';
  }
  const percentage = Math.max(0, Math.min(100, probability * 100));
  return `${percentage.toFixed(2)}%`;
}

/**
 * Format time interval in seconds to human-readable string
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (e.g., "2h 15m" or "45s")
 */
export function formatTimeInterval(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    // Handle Infinity and NaN cases
    if (seconds === Infinity || seconds === -Infinity) {
      return '∞';
    }
    return 'N/A';
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(' ');
}

/**
 * Calculate elapsed time since last block
 * @param {number} lastBlockTimestamp - Unix timestamp of last block (seconds)
 * @param {number} [currentTime] - Current Unix timestamp (seconds, defaults to now)
 * @returns {number} Elapsed time in seconds
 */
export function getTimeSinceLastBlock(lastBlockTimestamp, currentTime = Math.floor(Date.now() / 1000)) {
  if (!Number.isFinite(lastBlockTimestamp) || lastBlockTimestamp <= 0) {
    return 0;
  }
  if (!Number.isFinite(currentTime) || currentTime <= 0) {
    currentTime = Math.floor(Date.now() / 1000);
  }
  const elapsed = currentTime - lastBlockTimestamp;
  return Math.max(0, elapsed);
}

/**
 * Calculate network hashrate from difficulty
 * Formula from dataModels.js: H_network ≈ difficulty × 2^32 / 600
 * @param {number} difficulty - Network difficulty
 * @returns {number} Network hashrate in H/s
 */
export function getNetworkHashrateFromDifficulty(difficulty) {
  if (!Number.isFinite(difficulty) || difficulty <= 0) {
    return 0;
  }
  return (difficulty * Math.pow(2, 32)) / 600;
}

