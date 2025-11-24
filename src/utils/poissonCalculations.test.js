/**
 * @fileoverview Comprehensive unit tests for poissonCalculations.js
 * Tests statistical accuracy, edge cases, and integration scenarios
 */

import { describe, it, expect } from 'vitest';
import {
  // Mathematical Functions
  factorial,
  logFactorial,
  logGamma,
  // Poisson Distribution
  poissonPMF,
  poissonCDF,
  poissonQuantile,
  poissonMean,
  poissonStdDev,
  // Exponential Distribution
  exponentialPDF,
  exponentialCDF,
  exponentialQuantile,
  exponentialMean,
  exponentialMedian,
  // Pool Rate Calculations
  calculatePoolBlockRate,
  calculatePoolBlockRateFromShare,
  calculateExpectedBlocks,
  calculateExpectedTime,
  // Growth Factor
  calculateGrowthFactor,
  adjustLambda,
  calculateAdjustedExpectedTime,
  // Deviation Analysis
  calculateDeviation,
  calculatePValue,
  isDeviationSignificant,
  // Percentiles
  calculateTimePercentiles,
  calculateBlockCountPercentiles,
  calculateConfidenceInterval,
  // Curve Generation
  generateProbabilityCurve,
  generateCumulativeProbabilityCurve,
  generateDeviationBands,
  // High-Level Functions
  analyzePoolPerformance,
  calculateNextBlockProbabilities,
  generatePredictionData,
  // Utilities
  formatProbability,
  formatTimeInterval,
  getTimeSinceLastBlock,
  getNetworkHashrateFromDifficulty,
  // Constants
  BLOCK_TIME_SECONDS,
  BLOCKS_PER_DAY,
  NETWORK_BLOCK_RATE,
  E,
  LN_2,
  Z_SCORES,
} from './poissonCalculations.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create mock PoolInfo object for testing
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock PoolInfo object
 */
function createMockPoolInfo(overrides = {}) {
  return {
    id: 42,
    name: 'Test Pool',
    slug: 'testpool',
    link: 'https://testpool.com',
    estimatedHashrate: 4.23e19, // 42.3 EH/s
    lastEstimatedHashrate: 4.10e19,
    hashrateShare: 0.0705, // 7.05%
    blocksMined: 1247,
    blocksMined24h: 12,
    blockShare: 0.0705,
    emptyBlocks: 3,
    emptyBlocksShare: 0.0024,
    lastBlockHeight: 863542,
    lastBlockTimestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    rank: 8,
    ...overrides,
  };
}

/**
 * Create mock PoolBlock array for testing
 * @param {number} count - Number of blocks to create
 * @param {number} hoursAgo - Hours ago to start from
 * @returns {Array} Mock PoolBlock array
 */
function createMockBlocks(count, hoursAgo = 24) {
  const blocks = [];
  const currentTime = Math.floor(Date.now() / 1000);
  const startTime = currentTime - hoursAgo * 3600;
  const interval = (hoursAgo * 3600) / count;
  for (let i = 0; i < count; i++) {
    blocks.push({
      id: `block_${i}`,
      height: 863542 + i,
      version: 536870912,
      timestamp: Math.floor(startTime + i * interval),
      bits: 386089497,
      nonce: 2847261173 + i,
      difficulty: 88483843892345.67,
      merkleRoot: '9abf1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      tx_count: 2847,
      size: 1547892,
      weight: 3993456,
      previousblockhash: '00000000000000000001c5d3b2e47d65b4a26801054a160045b6a7d61617a943',
      medianTime: startTime + i * interval - 1500,
      reward: 637845231,
      fees: 12845231,
      extras: {
        pool: {
          id: 42,
          slug: 'testpool',
          name: 'Test Pool',
          link: 'https://testpool.com',
          matched: true,
        },
        coinbaseRaw: '03a01d0d...',
        coinbaseAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        coinbaseSignature: '/TestPool/',
        isEmpty: false,
        avgFeeRate: 15.3,
        avgFee: 4512,
      },
    });
  }
  return blocks;
}

/**
 * Numerically integrate PDF over range
 * @param {Function} pdf - PDF function
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} steps - Number of integration steps
 * @returns {number} Approximate integral
 */
function integratePDF(pdf, start, end, steps = 1000) {
  const dx = (end - start) / steps;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const x = start + i * dx;
    sum += pdf(x) * dx;
  }
  return sum;
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Constants', () => {
  it('should have correct block time constants', () => {
    expect(BLOCK_TIME_SECONDS).toBe(600);
    expect(BLOCKS_PER_DAY).toBe(144);
    expect(NETWORK_BLOCK_RATE).toBeCloseTo(1 / 600, 6);
  });

  it('should have correct mathematical constants', () => {
    expect(E).toBeCloseTo(Math.E, 10);
    expect(LN_2).toBeCloseTo(Math.LN2, 10);
  });

  it('should have correct z-score constants', () => {
    expect(Z_SCORES.P50).toBe(0);
    expect(Z_SCORES.P80).toBeCloseTo(0.8416, 3);
    expect(Z_SCORES.P90).toBeCloseTo(1.2816, 3);
  });
});

describe('Mathematical Functions', () => {
  describe('factorial', () => {
    it('should calculate factorial for known values', () => {
      expect(factorial(0)).toBe(1);
      expect(factorial(1)).toBe(1);
      expect(factorial(5)).toBe(120);
      expect(factorial(10)).toBe(3628800);
    });

    it('should handle edge cases', () => {
      expect(factorial(2)).toBe(2);
      expect(factorial(3)).toBe(6);
      expect(factorial(4)).toBe(24);
    });

    it('should throw error for negative numbers', () => {
      expect(() => factorial(-1)).toThrow();
    });

    it('should throw error for non-integers', () => {
      expect(() => factorial(1.5)).toThrow();
    });

    it('should throw error for numbers > 170', () => {
      expect(() => factorial(171)).toThrow();
    });

    it('should use memoization for performance', () => {
      const result1 = factorial(10);
      const result2 = factorial(10);
      expect(result1).toBe(result2);
      expect(result1).toBe(3628800);
    });
  });

  describe('logFactorial', () => {
    it('should calculate log factorial for small values', () => {
      expect(logFactorial(0)).toBe(0);
      expect(logFactorial(1)).toBe(0);
      expect(logFactorial(5)).toBeCloseTo(Math.log(120), 6);
      expect(logFactorial(10)).toBeCloseTo(Math.log(3628800), 6);
    });

    it('should handle large values using Stirling approximation', () => {
      const result = logFactorial(200);
      expect(result).toBeFinite();
      expect(result).toBeGreaterThan(0);
    });

    it('should throw error for negative numbers', () => {
      expect(() => logFactorial(-1)).toThrow();
    });
  });

  describe('logGamma', () => {
    it('should calculate log gamma for positive values', () => {
      expect(logGamma(1)).toBeCloseTo(0, 4);
      expect(logGamma(2)).toBeCloseTo(0, 4);
      expect(logGamma(3)).toBeCloseTo(Math.log(2), 4);
    });

    it('should throw error for non-positive values', () => {
      expect(() => logGamma(0)).toThrow();
      expect(() => logGamma(-1)).toThrow();
    });
  });
});

describe('Poisson Distribution Functions', () => {
  describe('poissonPMF', () => {
    it('should calculate PMF for known values', () => {
      // λ=5, k=3 should be ≈0.1404
      expect(poissonPMF(3, 5)).toBeCloseTo(0.14037389581428057, 4);
      expect(poissonPMF(0, 5)).toBeCloseTo(0.006737947, 4);
      expect(poissonPMF(5, 5)).toBeCloseTo(0.175467, 4);
    });

    it('should return 0 for negative k', () => {
      expect(poissonPMF(-1, 5)).toBe(0);
    });

    it('should handle lambda = 0', () => {
      expect(poissonPMF(0, 0)).toBe(1);
      expect(poissonPMF(1, 0)).toBe(0);
    });

    it('should throw error for negative lambda', () => {
      expect(() => poissonPMF(1, -1)).toThrow();
    });

    it('should return values in [0, 1] range', () => {
      for (let k = 0; k < 10; k++) {
        for (let lambda = 0.5; lambda <= 10; lambda += 0.5) {
          const pmf = poissonPMF(k, lambda);
          expect(pmf).toBeGreaterThanOrEqual(0);
          expect(pmf).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('poissonCDF', () => {
    it('should calculate CDF correctly', () => {
      // Sum of PMF values should equal CDF
      let sum = 0;
      for (let k = 0; k <= 10; k++) {
        sum += poissonPMF(k, 5);
      }
      expect(poissonCDF(10, 5)).toBeCloseTo(sum, 6);
    });

    it('should return 0 for negative k', () => {
      expect(poissonCDF(-1, 5)).toBe(0);
    });

    it('should approach 1 for large k', () => {
      const cdf = poissonCDF(100, 5);
      expect(cdf).toBeGreaterThan(0.99);
      expect(cdf).toBeLessThanOrEqual(1);
    });

    it('should handle lambda = 0', () => {
      expect(poissonCDF(0, 0)).toBe(1);
      expect(poissonCDF(1, 0)).toBe(1);
    });
  });

  describe('poissonQuantile', () => {
    it('should return correct percentiles for large lambda', () => {
      const lambda = 10;
      const q50 = poissonQuantile(0.5, lambda);
      const q80 = poissonQuantile(0.8, lambda);
      const q90 = poissonQuantile(0.9, lambda);
      expect(q50).toBeLessThanOrEqual(q80);
      expect(q80).toBeLessThanOrEqual(q90);
    });

    it('should throw error for invalid percentile', () => {
      expect(() => poissonQuantile(-0.1, 5)).toThrow();
      expect(() => poissonQuantile(1.1, 5)).toThrow();
    });

    it('should handle edge cases', () => {
      expect(poissonQuantile(0, 5)).toBe(0);
      expect(poissonQuantile(1, 5)).toBe(Infinity);
    });
  });

  describe('poissonMean', () => {
    it('should return lambda as mean', () => {
      expect(poissonMean(5)).toBe(5);
      expect(poissonMean(10)).toBe(10);
      expect(poissonMean(0)).toBe(0);
    });
  });

  describe('poissonStdDev', () => {
    it('should return √λ as standard deviation', () => {
      expect(poissonStdDev(4)).toBe(2);
      expect(poissonStdDev(9)).toBe(3);
      expect(poissonStdDev(0)).toBe(0);
    });

    it('should throw error for negative lambda', () => {
      expect(() => poissonStdDev(-1)).toThrow();
    });
  });
});

describe('Exponential Distribution Functions', () => {
  const lambda = 0.0001175; // From example: λ_pool ≈ 0.0001175 blocks/second

  describe('exponentialPDF', () => {
    it('should calculate PDF correctly', () => {
      const pdf0 = exponentialPDF(0, lambda);
      expect(pdf0).toBeCloseTo(lambda, 6);
      expect(pdf0).toBeGreaterThan(0);
    });

    it('should decrease over time', () => {
      const pdf1 = exponentialPDF(1000, lambda);
      const pdf2 = exponentialPDF(2000, lambda);
      expect(pdf2).toBeLessThan(pdf1);
    });

    it('should integrate to approximately 1', () => {
      const integral = integratePDF(
        (t) => exponentialPDF(t, lambda),
        0,
        86400, // 24 hours
        10000
      );
      expect(integral).toBeCloseTo(1, 2);
    });

    it('should return 0 for negative time', () => {
      expect(exponentialPDF(-1, lambda)).toBe(0);
    });
  });

  describe('exponentialCDF', () => {
    it('should calculate CDF correctly', () => {
      expect(exponentialCDF(0, lambda)).toBe(0);
      expect(exponentialCDF(10000, lambda)).toBeGreaterThan(0);
      expect(exponentialCDF(10000, lambda)).toBeLessThan(1);
    });

    it('should approach 1 as t → ∞', () => {
      const cdf = exponentialCDF(1000000, lambda);
      expect(cdf).toBeGreaterThan(0.99);
      expect(cdf).toBeLessThanOrEqual(1);
    });

    it('should satisfy memoryless property', () => {
      // P(T > s+t | T > s) = P(T > t)
      const s = 1000;
      const t = 2000;
      const prob1 = 1 - exponentialCDF(s + t, lambda);
      const prob2 = 1 - exponentialCDF(s, lambda);
      const prob3 = 1 - exponentialCDF(t, lambda);
      const conditional = prob1 / prob2;
      expect(conditional).toBeCloseTo(prob3, 4);
    });

    it('should return 0 for negative time', () => {
      expect(exponentialCDF(-1, lambda)).toBe(0);
    });
  });

  describe('exponentialQuantile', () => {
    it('should calculate correct percentiles', () => {
      const median = exponentialQuantile(0.5, lambda);
      const expectedMedian = LN_2 / lambda;
      expect(median).toBeCloseTo(expectedMedian, 4);
    });

    it('should return increasing values for increasing percentiles', () => {
      const p50 = exponentialQuantile(0.5, lambda);
      const p80 = exponentialQuantile(0.8, lambda);
      const p90 = exponentialQuantile(0.9, lambda);
      expect(p80).toBeGreaterThan(p50);
      expect(p90).toBeGreaterThan(p80);
    });

    it('should match documented formulas', () => {
      // t_50 = ln(2)/λ ≈ 0.693/λ
      const t50 = exponentialQuantile(0.5, lambda);
      expect(t50).toBeCloseTo(LN_2 / lambda, 4);
      // t_80 = -ln(0.2)/λ ≈ 1.609/λ
      const t80 = exponentialQuantile(0.8, lambda);
      expect(t80).toBeCloseTo(-Math.log(0.2) / lambda, 4);
      // t_90 = -ln(0.1)/λ ≈ 2.303/λ
      const t90 = exponentialQuantile(0.9, lambda);
      expect(t90).toBeCloseTo(-Math.log(0.1) / lambda, 4);
    });

    it('should throw error for invalid percentile', () => {
      expect(() => exponentialQuantile(-0.1, lambda)).toThrow();
      expect(() => exponentialQuantile(1.1, lambda)).toThrow();
    });
  });

  describe('exponentialMean', () => {
    it('should return 1/λ as mean', () => {
      expect(exponentialMean(lambda)).toBeCloseTo(1 / lambda, 6);
    });

    it('should throw error for non-positive lambda', () => {
      expect(() => exponentialMean(0)).toThrow();
      expect(() => exponentialMean(-1)).toThrow();
    });
  });

  describe('exponentialMedian', () => {
    it('should return ln(2)/λ as median', () => {
      const median = exponentialMedian(lambda);
      expect(median).toBeCloseTo(LN_2 / lambda, 6);
    });

    it('should throw error for non-positive lambda', () => {
      expect(() => exponentialMedian(0)).toThrow();
      expect(() => exponentialMedian(-1)).toThrow();
    });
  });
});

describe('Pool Rate Calculations', () => {
  describe('calculatePoolBlockRate', () => {
    it('should calculate pool block rate from hashrate ratio', () => {
      // Example from docs: pool 42.3 EH/s, network 600 EH/s → λ ≈ 0.0001175
      const poolHashrate = 4.23e19; // 42.3 EH/s
      const networkHashrate = 6.0e20; // 600 EH/s
      const rate = calculatePoolBlockRate(poolHashrate, networkHashrate);
      expect(rate).toBeCloseTo(0.0001175, 6);
    });

    it('should return 0 for zero pool hashrate', () => {
      expect(calculatePoolBlockRate(0, 6.0e20)).toBe(0);
    });

    it('should throw error for invalid inputs', () => {
      expect(() => calculatePoolBlockRate(-1, 6.0e20)).toThrow();
      expect(() => calculatePoolBlockRate(4.23e19, 0)).toThrow();
      expect(() => calculatePoolBlockRate(4.23e19, -1)).toThrow();
    });
  });

  describe('calculatePoolBlockRateFromShare', () => {
    it('should calculate pool block rate from share', () => {
      const share = 0.0705; // 7.05%
      const rate = calculatePoolBlockRateFromShare(share);
      expect(rate).toBeCloseTo(0.0001175, 6);
    });

    it('should throw error for invalid share', () => {
      expect(() => calculatePoolBlockRateFromShare(-0.1)).toThrow();
      expect(() => calculatePoolBlockRateFromShare(1.1)).toThrow();
    });
  });

  describe('calculateExpectedBlocks', () => {
    it('should calculate expected blocks for 24-hour period', () => {
      const lambda = 0.0001175;
      const timeSeconds = 86400; // 24 hours
      const expected = calculateExpectedBlocks(lambda, timeSeconds);
      expect(expected).toBeCloseTo(10.15, 2);
    });

    it('should return 0 for zero lambda or time', () => {
      expect(calculateExpectedBlocks(0, 86400)).toBe(0);
      expect(calculateExpectedBlocks(0.0001175, 0)).toBe(0);
    });
  });

  describe('calculateExpectedTime', () => {
    it('should calculate expected time correctly', () => {
      const lambda = 0.0001175;
      const expectedTime = calculateExpectedTime(lambda);
      expect(expectedTime).toBeCloseTo(1 / lambda, 6);
      expect(expectedTime).toBeCloseTo(8511, 0); // ≈ 2.36 hours
    });

    it('should throw error for non-positive lambda', () => {
      expect(() => calculateExpectedTime(0)).toThrow();
      expect(() => calculateExpectedTime(-1)).toThrow();
    });
  });
});

describe('Growth Factor & Adjustment', () => {
  describe('calculateGrowthFactor', () => {
    it('should calculate growth factor from example', () => {
      // Expected: 10.15, Observed: 12 → growth_factor = 1.182
      const growthFactor = calculateGrowthFactor(12, 10.15);
      expect(growthFactor).toBeCloseTo(1.182, 3);
    });

    it('should handle edge cases', () => {
      expect(calculateGrowthFactor(0, 0)).toBe(1);
      expect(calculateGrowthFactor(10, 0)).toBe(Infinity);
      expect(calculateGrowthFactor(0, 10)).toBe(0);
    });
  });

  describe('adjustLambda', () => {
    it('should adjust lambda correctly', () => {
      const lambdaExpected = 0.0001175;
      const growthFactor = 1.182;
      const lambdaAdjusted = adjustLambda(lambdaExpected, growthFactor);
      expect(lambdaAdjusted).toBeCloseTo(0.0000994, 7);
    });

    it('should return original lambda for invalid growth factor', () => {
      const lambda = 0.0001175;
      expect(adjustLambda(lambda, 0)).toBe(lambda);
      expect(adjustLambda(lambda, -1)).toBe(lambda);
      expect(adjustLambda(lambda, Infinity)).toBe(lambda);
    });
  });

  describe('calculateAdjustedExpectedTime', () => {
    it('should calculate adjusted expected time', () => {
      const lambdaExpected = 0.0001175;
      const growthFactor = 1.182;
      const adjustedTime = calculateAdjustedExpectedTime(lambdaExpected, growthFactor);
      expect(adjustedTime).toBeCloseTo(10060, 0); // ≈ 2.79 hours
    });

    it('should return unadjusted time for invalid growth factor', () => {
      const lambda = 0.0001175;
      const unadjusted = calculateExpectedTime(lambda);
      expect(calculateAdjustedExpectedTime(lambda, 0)).toBeCloseTo(unadjusted, 6);
    });
  });
});

describe('Deviation Analysis', () => {
  describe('calculateDeviation', () => {
    it('should calculate deviation from example', () => {
      // Observed: 12, Expected: 10.15, σ ≈ 3.19 → deviation ≈ 0.58
      const lambda = 0.0001175;
      const timeSeconds = 86400; // 24 hours
      const expectedBlocks = 10.15;
      const observedBlocks = 12;
      const deviation = calculateDeviation(observedBlocks, expectedBlocks, lambda, timeSeconds);
      expect(deviation).toBeCloseTo(0.58, 2);
    });

    it('should return 0 for no variance', () => {
      expect(calculateDeviation(5, 5, 0, 86400)).toBe(0);
    });

    it('should handle negative deviations', () => {
      const deviation = calculateDeviation(8, 10, 0.0001175, 86400);
      expect(deviation).toBeLessThan(0);
    });
  });

  describe('calculatePValue', () => {
    it('should return values in [0, 1] range', () => {
      const pValue = calculatePValue(12, 0.0001175, 86400);
      expect(pValue).toBeGreaterThanOrEqual(0);
      expect(pValue).toBeLessThanOrEqual(1);
    });

    it('should return 0 for impossible observations', () => {
      // With λ=0, no blocks possible
      const pValue = calculatePValue(1, 0, 86400);
      expect(pValue).toBe(0);
    });

    it('should return 1 for zero observations with zero lambda', () => {
      const pValue = calculatePValue(0, 0, 86400);
      expect(pValue).toBe(1);
    });
  });

  describe('isDeviationSignificant', () => {
    it('should detect significant deviations', () => {
      // |z| > 1.96 for α = 0.05
      expect(isDeviationSignificant(2.0, 0.05)).toBe(true);
      expect(isDeviationSignificant(-2.0, 0.05)).toBe(true);
      expect(isDeviationSignificant(1.0, 0.05)).toBe(false);
    });

    it('should throw error for invalid alpha', () => {
      expect(() => isDeviationSignificant(1.0, 0)).toThrow();
      expect(() => isDeviationSignificant(1.0, 1)).toThrow();
      expect(() => isDeviationSignificant(1.0, -0.1)).toThrow();
    });
  });
});

describe('Percentile & Confidence Interval Functions', () => {
  const lambda = 0.0001175;

  describe('calculateTimePercentiles', () => {
    it('should return increasing percentiles', () => {
      const percentiles = calculateTimePercentiles(lambda, [0.5, 0.8, 0.9]);
      expect(percentiles[0]).toBeLessThan(percentiles[1]);
      expect(percentiles[1]).toBeLessThan(percentiles[2]);
    });

    it('should match documented formulas', () => {
      const percentiles = calculateTimePercentiles(lambda, [0.5, 0.8, 0.9]);
      expect(percentiles[0]).toBeCloseTo(5898, 0); // t_50 ≈ 1.64 hours
      expect(percentiles[1]).toBeCloseTo(13694, 0); // t_80 ≈ 3.80 hours
      expect(percentiles[2]).toBeCloseTo(19600, 0); // t_90 ≈ 5.44 hours
    });

    it('should throw error for non-positive lambda', () => {
      expect(() => calculateTimePercentiles(0, [0.5])).toThrow();
      expect(() => calculateTimePercentiles(-1, [0.5])).toThrow();
    });
  });

  describe('calculateBlockCountPercentiles', () => {
    it('should return increasing percentiles', () => {
      const timeSeconds = 86400; // 24 hours
      const percentiles = calculateBlockCountPercentiles(lambda, timeSeconds, [0.5, 0.8, 0.9]);
      expect(percentiles[0]).toBeLessThanOrEqual(percentiles[1]);
      expect(percentiles[1]).toBeLessThanOrEqual(percentiles[2]);
    });

    it('should handle zero time', () => {
      const percentiles = calculateBlockCountPercentiles(lambda, 0, [0.5, 0.8, 0.9]);
      expect(percentiles.every(p => p === 0)).toBe(true);
    });
  });

  describe('calculateConfidenceInterval', () => {
    it('should return valid confidence interval', () => {
      const ci = calculateConfidenceInterval(lambda, 0.9);
      expect(ci.lower).toBeGreaterThanOrEqual(0);
      expect(ci.upper).toBeGreaterThan(ci.lower);
    });

    it('should throw error for invalid confidence level', () => {
      expect(() => calculateConfidenceInterval(lambda, 0)).toThrow();
      expect(() => calculateConfidenceInterval(lambda, 1)).toThrow();
      expect(() => calculateConfidenceInterval(lambda, -0.1)).toThrow();
    });
  });
});

describe('Probability Curve Generation', () => {
  const lambda = 0.0001175;
  const maxTime = 86400; // 24 hours

  describe('generateProbabilityCurve', () => {
    it('should return correct number of points', () => {
      const curve = generateProbabilityCurve(lambda, maxTime, 100);
      expect(curve.length).toBe(101); // n+1 points
    });

    it('should return non-negative probabilities', () => {
      const curve = generateProbabilityCurve(lambda, maxTime, 100);
      curve.forEach(point => {
        expect(point.probability).toBeGreaterThanOrEqual(0);
        expect(point.time).toBeGreaterThanOrEqual(0);
      });
    });

    it('should decrease over time', () => {
      const curve = generateProbabilityCurve(lambda, maxTime, 100);
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].probability).toBeLessThanOrEqual(curve[i - 1].probability);
      }
    });
  });

  describe('generateCumulativeProbabilityCurve', () => {
    it('should return monotonically increasing values', () => {
      const curve = generateCumulativeProbabilityCurve(lambda, maxTime, 100);
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].cumulativeProbability).toBeGreaterThanOrEqual(curve[i - 1].cumulativeProbability);
      }
    });

    it('should approach 1 at end', () => {
      const curve = generateCumulativeProbabilityCurve(lambda, maxTime, 100);
      const lastProb = curve[curve.length - 1].cumulativeProbability;
      expect(lastProb).toBeGreaterThan(0.99);
      expect(lastProb).toBeLessThanOrEqual(1);
    });
  });

  describe('generateDeviationBands', () => {
    it('should return upper and lower bands', () => {
      const bands = generateDeviationBands(lambda, maxTime, 100, 0.9);
      expect(bands.upper).toBeDefined();
      expect(bands.lower).toBeDefined();
      expect(bands.upper.length).toBe(101);
      expect(bands.lower.length).toBe(101);
    });
  });
});

describe('High-Level Analysis Functions', () => {
  describe('analyzePoolPerformance', () => {
    it('should analyze pool performance correctly', () => {
      const poolInfo = createMockPoolInfo({
        hashrateShare: 0.0705, // 7.05%
        blocksMined24h: 12,
        lastBlockTimestamp: Math.floor(Date.now() / 1000) - 3600,
      });
      const blocks = createMockBlocks(12, 24);
      const analysis = analyzePoolPerformance(poolInfo, blocks, 24);
      expect(analysis).toHaveProperty('observedBlocks');
      expect(analysis).toHaveProperty('expectedBlocks');
      expect(analysis).toHaveProperty('growthFactor');
      expect(analysis).toHaveProperty('lambdaExpected');
      expect(analysis).toHaveProperty('lambdaAdjusted');
      expect(analysis).toHaveProperty('deviation');
      expect(analysis).toHaveProperty('pValue');
      expect(analysis.observedBlocks).toBeGreaterThanOrEqual(0);
      expect(analysis.expectedBlocks).toBeGreaterThanOrEqual(0);
      expect(analysis.growthFactor).toBeGreaterThan(0);
    });

    it('should handle empty blocks array', () => {
      const poolInfo = createMockPoolInfo({ hashrateShare: 0.0705 });
      const blocks = [];
      const analysis = analyzePoolPerformance(poolInfo, blocks, 24);
      expect(analysis.observedBlocks).toBe(0);
    });

    it('should throw error for invalid pool info', () => {
      expect(() => analyzePoolPerformance(null, [], 24)).toThrow();
      expect(() => analyzePoolPerformance({}, [], 24)).toThrow();
    });

    it('should throw error for invalid blocks', () => {
      const poolInfo = createMockPoolInfo({ hashrateShare: 0.0705 });
      expect(() => analyzePoolPerformance(poolInfo, null, 24)).toThrow();
    });
  });

  describe('calculateNextBlockProbabilities', () => {
    it('should return probabilities for all time windows', () => {
      const lambda = 0.0001175;
      const timeSinceLastBlock = 3600; // 1 hour
      const probs = calculateNextBlockProbabilities(lambda, timeSinceLastBlock);
      expect(probs).toHaveProperty('within1h');
      expect(probs).toHaveProperty('within2h');
      expect(probs).toHaveProperty('within4h');
      expect(probs).toHaveProperty('within8h');
      expect(probs).toHaveProperty('within12h');
      expect(probs).toHaveProperty('within24h');
      // All probabilities should be in [0, 1]
      Object.values(probs).forEach(prob => {
        expect(prob).toBeGreaterThanOrEqual(0);
        expect(prob).toBeLessThanOrEqual(1);
      });
    });

    it('should return increasing probabilities for longer windows', () => {
      const lambda = 0.0001175;
      const probs = calculateNextBlockProbabilities(lambda, 0);
      expect(probs.within1h).toBeLessThan(probs.within2h);
      expect(probs.within2h).toBeLessThan(probs.within4h);
      expect(probs.within4h).toBeLessThan(probs.within8h);
      expect(probs.within8h).toBeLessThan(probs.within12h);
      expect(probs.within12h).toBeLessThan(probs.within24h);
    });

    it('should throw error for non-positive lambda', () => {
      expect(() => calculateNextBlockProbabilities(0, 0)).toThrow();
      expect(() => calculateNextBlockProbabilities(-1, 0)).toThrow();
    });
  });

  describe('generatePredictionData', () => {
    it('should generate complete prediction data', () => {
      const poolInfo = createMockPoolInfo({
        hashrateShare: 0.0705,
        lastBlockTimestamp: Math.floor(Date.now() / 1000) - 3600,
      });
      const blocks = createMockBlocks(12, 24);
      const data = generatePredictionData(poolInfo, blocks);
      expect(data).toHaveProperty('analysis');
      expect(data).toHaveProperty('probabilityCurve');
      expect(data).toHaveProperty('cumulativeCurve');
      expect(data).toHaveProperty('deviationBands');
      expect(data).toHaveProperty('nextBlockProbabilities');
      expect(data).toHaveProperty('timeSinceLastBlock');
      expect(data).toHaveProperty('statistics');
      expect(data.statistics).toHaveProperty('mean');
      expect(data.statistics).toHaveProperty('median');
      expect(data.statistics).toHaveProperty('stdDev');
      expect(data.statistics).toHaveProperty('confidenceInterval');
    });

    it('should handle empty blocks array', () => {
      const poolInfo = createMockPoolInfo({
        hashrateShare: 0.0705,
        lastBlockTimestamp: Math.floor(Date.now() / 1000) - 3600,
      });
      const blocks = [];
      const data = generatePredictionData(poolInfo, blocks);
      expect(data.analysis.observedBlocks).toBe(0);
      expect(data.timeSinceLastBlock).toBeGreaterThanOrEqual(0);
    });

    it('should use custom analysisWindowHours parameter', () => {
      const poolInfo = createMockPoolInfo({
        hashrateShare: 0.0705,
        lastBlockTimestamp: Math.floor(Date.now() / 1000) - 3600,
      });
      const blocks = createMockBlocks(6, 12); // 6 blocks in last 12 hours
      const data24h = generatePredictionData(poolInfo, blocks, undefined, 24);
      const data12h = generatePredictionData(poolInfo, blocks, undefined, 12);
      // Different analysis windows should produce different expected blocks
      expect(data24h.analysis.expectedBlocks).toBeGreaterThan(data12h.analysis.expectedBlocks);
    });
  });
});

describe('Utility Functions', () => {
  describe('formatProbability', () => {
    it('should format probability as percentage', () => {
      expect(formatProbability(0.5)).toBe('50.00%');
      expect(formatProbability(0.1234)).toBe('12.34%');
      expect(formatProbability(1)).toBe('100.00%');
      expect(formatProbability(0)).toBe('0.00%');
    });

    it('should handle edge cases', () => {
      expect(formatProbability(1.5)).toBe('100.00%'); // Clamped
      expect(formatProbability(-0.1)).toBe('0.00%'); // Clamped
      expect(formatProbability(Infinity)).toBe('0%');
      expect(formatProbability(NaN)).toBe('0%');
    });
  });

  describe('formatTimeInterval', () => {
    it('should format time intervals correctly', () => {
      expect(formatTimeInterval(45)).toBe('45s');
      expect(formatTimeInterval(120)).toBe('2m');
      expect(formatTimeInterval(3665)).toBe('1h 1m 5s');
      expect(formatTimeInterval(86400)).toBe('1d');
    });

    it('should handle edge cases', () => {
      expect(formatTimeInterval(0)).toBe('0s');
      expect(formatTimeInterval(-1)).toBe('0s');
      expect(formatTimeInterval(Infinity)).toBe('0s');
      expect(formatTimeInterval(NaN)).toBe('0s');
    });
  });

  describe('getTimeSinceLastBlock', () => {
    it('should calculate elapsed time correctly', () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const lastBlockTime = currentTime - 3600; // 1 hour ago
      const elapsed = getTimeSinceLastBlock(lastBlockTime, currentTime);
      expect(elapsed).toBe(3600);
    });

    it('should default to current time', () => {
      const lastBlockTime = Math.floor(Date.now() / 1000) - 3600;
      const elapsed = getTimeSinceLastBlock(lastBlockTime);
      expect(elapsed).toBeCloseTo(3600, 5); // Within 5 seconds
    });

    it('should return 0 for invalid timestamps', () => {
      expect(getTimeSinceLastBlock(0)).toBe(0);
      expect(getTimeSinceLastBlock(-1)).toBe(0);
      expect(getTimeSinceLastBlock(NaN)).toBe(0);
    });
  });

  describe('getNetworkHashrateFromDifficulty', () => {
    it('should calculate network hashrate from difficulty', () => {
      const difficulty = 88483843892345.67;
      const hashrate = getNetworkHashrateFromDifficulty(difficulty);
      expect(hashrate).toBeGreaterThan(0);
      // H_network ≈ difficulty × 2^32 / 600
      const expected = (difficulty * Math.pow(2, 32)) / 600;
      expect(hashrate).toBeCloseTo(expected, 0);
    });

    it('should return 0 for invalid difficulty', () => {
      expect(getNetworkHashrateFromDifficulty(0)).toBe(0);
      expect(getNetworkHashrateFromDifficulty(-1)).toBe(0);
      expect(getNetworkHashrateFromDifficulty(NaN)).toBe(0);
    });
  });
});

describe('Edge Cases & Error Handling', () => {
  it('should handle zero lambda gracefully', () => {
    expect(poissonPMF(0, 0)).toBe(1);
    expect(poissonPMF(1, 0)).toBe(0);
    expect(exponentialPDF(1000, 0)).toBe(0);
    expect(exponentialCDF(1000, 0)).toBe(0);
  });

  it('should handle very small lambda values', () => {
    const smallLambda = 1e-10;
    const pmf = poissonPMF(0, smallLambda);
    expect(pmf).toBeGreaterThan(0);
    expect(pmf).toBeLessThanOrEqual(1);
  });

  it('should handle very large time values', () => {
    const lambda = 0.0001175;
    const cdf = exponentialCDF(1e10, lambda);
    expect(cdf).toBeGreaterThan(0.99);
    expect(cdf).toBeLessThanOrEqual(1);
  });

  it('should handle negative time values', () => {
    const lambda = 0.0001175;
    expect(exponentialPDF(-1000, lambda)).toBe(0);
    expect(exponentialCDF(-1000, lambda)).toBe(0);
  });
});

describe('Integration Tests', () => {
  it('should provide consistent results across function calls', () => {
    const poolInfo = createMockPoolInfo({
      hashrateShare: 0.0705,
      lastBlockTimestamp: Math.floor(Date.now() / 1000) - 3600,
    });
    const blocks = createMockBlocks(12, 24);
    const data1 = generatePredictionData(poolInfo, blocks);
    const data2 = generatePredictionData(poolInfo, blocks);
    // Results should be deterministic (within floating-point precision)
    expect(data1.analysis.lambdaExpected).toBeCloseTo(data2.analysis.lambdaExpected, 6);
    expect(data1.timeSinceLastBlock).toBe(data2.timeSinceLastBlock);
  });

  it('should handle real-world example from documentation', () => {
    // Example from API_CONTEXT.md
    const poolHashrate = 4.23e19; // 42.3 EH/s
    const networkHashrate = 6.0e20; // 600 EH/s
    const poolShare = poolHashrate / networkHashrate; // 0.0705
    const lambda = calculatePoolBlockRateFromShare(poolShare);
    expect(lambda).toBeCloseTo(0.0001175, 6);
    const expectedTime = calculateExpectedTime(lambda);
    expect(expectedTime).toBeCloseTo(8511, 0); // ≈ 2.36 hours
    const median = exponentialMedian(lambda);
    expect(median).toBeCloseTo(5898, 0); // ≈ 1.64 hours
  });
});

