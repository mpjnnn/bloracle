/**
 * @fileoverview Data models and transformation utilities for mempool.space API responses.
 * Provides type definitions, normalization, validation, and utility functions.
 */

/**
 * @typedef {Object} PoolAttribution
 * @property {number} id - Internal pool ID
 * @property {string} slug - Pool slug identifier
 * @property {string} name - Pool display name
 * @property {string} link - Pool website URL (if known)
 * @property {boolean} matched - Whether attribution is confident
 */

/**
 * @typedef {Object} PoolExtras
 * @property {PoolAttribution} pool - Pool attribution information
 * @property {string} coinbaseRaw - Raw coinbase transaction hex
 * @property {string} coinbaseAddress - Coinbase output address
 * @property {string} coinbaseSignature - Pool tag in coinbase
 * @property {boolean} isEmpty - Whether block contains only coinbase transaction
 * @property {number} avgFeeRate - Average fee rate in sat/vB
 * @property {number} avgFee - Average fee per transaction in satoshis
 * @property {number} [totalInputs] - Total number of inputs
 * @property {number} [totalOutputs] - Total number of outputs
 */

/**
 * @typedef {Object} PoolBlock
 * @property {string} id - Block hash
 * @property {number} height - Block height in the blockchain
 * @property {number} version - Block version number
 * @property {number} timestamp - Unix timestamp when block was mined
 * @property {number} bits - Difficulty target bits
 * @property {number} nonce - Nonce value used to mine the block
 * @property {number} difficulty - Network difficulty at the time
 * @property {string} merkleRoot - Merkle root hash
 * @property {number} tx_count - Number of transactions in the block
 * @property {number} size - Block size in bytes
 * @property {number} weight - Block weight (BIP 141)
 * @property {string} previousblockhash - Hash of the previous block
 * @property {number} medianTime - Median time of the last 11 blocks
 * @property {number} reward - Block reward in satoshis (subsidy + fees)
 * @property {number} fees - Total transaction fees in satoshis
 * @property {PoolExtras} extras - Additional metadata
 * @property {number} rewardBTC - Computed: reward in BTC
 * @property {number} feesBTC - Computed: fees in BTC
 * @property {number} avgFee - Computed: average fee per transaction (from extras.avgFee)
 * @property {number} medianFeeRate - Computed: median fee rate (from extras.avgFeeRate)
 */

/**
 * @typedef {Object} PoolInfo
 * @property {number} id - Internal numeric pool ID
 * @property {string} name - Pool display name
 * @property {string} slug - URL slug identifier
 * @property {string} link - Pool website URL (if known)
 * @property {number} estimatedHashrate - Current estimated pool hashrate in H/s
 * @property {number} lastEstimatedHashrate - Previous hashrate estimate for smoothing
 * @property {number} hashrateShare - Pool share of total network hashrate (0-1)
 * @property {number} blocksMined - Total blocks attributed to this pool
 * @property {number} blocksMined24h - Blocks mined in the last 24 hours
 * @property {number} blockShare - Pool share of recent blocks (0-1)
 * @property {number} emptyBlocks - Number of empty blocks mined
 * @property {number} emptyBlocksShare - Share of pool blocks that were empty (0-1)
 * @property {number} lastBlockHeight - Most recent block height mined by pool
 * @property {number} lastBlockTimestamp - Unix timestamp of last block
 * @property {number} rank - Pool rank by hashrate/blocks in recent window
 * @property {number} hashrateEH - Computed: hashrate in EH/s
 * @property {number} hashrateSharePercent - Computed: hashrate share as percentage
 * @property {number} blockSharePercent - Computed: block share as percentage
 */

/**
 * @typedef {Object} CacheEntry
 * @property {*} data - Cached data
 * @property {number} timestamp - Timestamp when cached (milliseconds)
 * @property {number} ttl - Time-to-live in milliseconds
 */

/**
 * @typedef {Object} ApiErrorDetails
 * @property {number|null} status - HTTP status code
 * @property {string} message - Error message
 * @property {string|null} endpoint - API endpoint that failed
 * @property {boolean} retryable - Whether the error is retryable
 */

// Data Transformation Functions

/**
 * Normalize raw API block response
 * @param {Object} rawBlock - Raw block object from API
 * @returns {PoolBlock} Normalized block object
 */
export function normalizeBlock(rawBlock) {
  const block = {
    id: rawBlock.id || '',
    height: rawBlock.height ?? 0,
    version: rawBlock.version ?? 0,
    timestamp: rawBlock.timestamp ?? 0,
    bits: rawBlock.bits ?? 0,
    nonce: rawBlock.nonce ?? 0,
    difficulty: rawBlock.difficulty ?? 0,
    merkleRoot: rawBlock.merkleRoot || '',
    tx_count: rawBlock.tx_count ?? 0,
    size: rawBlock.size ?? 0,
    weight: rawBlock.weight ?? 0,
    previousblockhash: rawBlock.previousblockhash || '',
    medianTime: rawBlock.medianTime ?? 0,
    reward: rawBlock.reward ?? 0,
    fees: rawBlock.fees ?? 0,
    extras: {
      pool: {
        id: rawBlock.extras?.pool?.id ?? 0,
        slug: rawBlock.extras?.pool?.slug || '',
        name: rawBlock.extras?.pool?.name || '',
        link: rawBlock.extras?.pool?.link || '',
        matched: rawBlock.extras?.pool?.matched ?? false,
      },
      coinbaseRaw: rawBlock.extras?.coinbaseRaw || '',
      coinbaseAddress: rawBlock.extras?.coinbaseAddress || '',
      coinbaseSignature: rawBlock.extras?.coinbaseSignature || '',
      isEmpty: rawBlock.extras?.isEmpty ?? false,
      avgFeeRate: rawBlock.extras?.avgFeeRate ?? 0,
      avgFee: rawBlock.extras?.avgFee ?? 0,
      totalInputs: rawBlock.extras?.totalInputs,
      totalOutputs: rawBlock.extras?.totalOutputs,
    },
  };

  // Add computed properties
  block.rewardBTC = satoshiToBTC(block.reward);
  block.feesBTC = satoshiToBTC(block.fees);
  block.avgFee = block.extras.avgFee;
  block.medianFeeRate = block.extras.avgFeeRate;

  return block;
}

/**
 * Normalize raw API pool info response
 * @param {Object} rawPoolInfo - Raw pool info object from API
 * @returns {PoolInfo} Normalized pool info object
 */
export function normalizePoolInfo(rawPoolInfo) {
  // Normalize blockShare: API returns as decimal (0-1), but handle percentage format if > 1
  // Clamp to valid range [0, 1]
  let blockShare = rawPoolInfo.blockShare;
  if (typeof blockShare === 'number' && !isNaN(blockShare)) {
    // If > 1 and <= 100, assume it's a percentage and convert to decimal
    if (blockShare > 1 && blockShare <= 100) {
      blockShare = blockShare / 100;
    }
    // Clamp to valid range [0, 1]
    blockShare = Math.max(0, Math.min(1, blockShare));
  } else if (blockShare === null || blockShare === undefined) {
    blockShare = 0;
  } else {
    // Invalid type, default to 0
    blockShare = 0;
  }
  
  // Normalize hashrateShare: API returns as decimal (0-1), but handle percentage format if > 1
  // This is the critical field for calculations - preserve small values!
  let hashrateShare = rawPoolInfo.hashrateShare;
  if (typeof hashrateShare === 'number' && !isNaN(hashrateShare)) {
    // If > 1 and <= 100, assume it's a percentage and convert to decimal
    if (hashrateShare > 1 && hashrateShare <= 100) {
      hashrateShare = hashrateShare / 100;
    }
    // Clamp to valid range [0, 1] - but preserve very small values!
    // Don't clamp if it's already in valid range
    if (hashrateShare < 0) {
      hashrateShare = 0;
    } else if (hashrateShare > 1) {
      hashrateShare = 1;
    }
    // If hashrateShare is between 0 and 1, keep it as-is (even if very small like 0.0001)
  } else if (hashrateShare === null || hashrateShare === undefined) {
    hashrateShare = 0;
  } else {
    // Invalid type, default to 0
    hashrateShare = 0;
  }
  
  // Normalize emptyBlocksShare: API returns as decimal (0-1), but handle percentage format if > 1
  // Clamp to valid range [0, 1]
  let emptyBlocksShare = rawPoolInfo.emptyBlocksShare;
  if (typeof emptyBlocksShare === 'number' && !isNaN(emptyBlocksShare)) {
    // If > 1 and <= 100, assume it's a percentage and convert to decimal
    if (emptyBlocksShare > 1 && emptyBlocksShare <= 100) {
      emptyBlocksShare = emptyBlocksShare / 100;
    }
    // Clamp to valid range [0, 1]
    emptyBlocksShare = Math.max(0, Math.min(1, emptyBlocksShare));
  } else if (emptyBlocksShare === null || emptyBlocksShare === undefined) {
    emptyBlocksShare = 0;
  } else {
    // Invalid type, default to 0
    emptyBlocksShare = 0;
  }

  const poolInfo = {
    id: rawPoolInfo.id ?? 0,
    name: rawPoolInfo.name || '',
    slug: rawPoolInfo.slug || '',
    link: rawPoolInfo.link || '',
    estimatedHashrate: rawPoolInfo.estimatedHashrate ?? 0,
    lastEstimatedHashrate: rawPoolInfo.lastEstimatedHashrate ?? 0,
    hashrateShare: hashrateShare,
    blocksMined: rawPoolInfo.blocksMined ?? 0,
    blocksMined24h: rawPoolInfo.blocksMined24h ?? 0,
    blockShare: blockShare,
    emptyBlocks: rawPoolInfo.emptyBlocks ?? 0,
    emptyBlocksShare: emptyBlocksShare,
    lastBlockHeight: rawPoolInfo.lastBlockHeight ?? 0,
    lastBlockTimestamp: rawPoolInfo.lastBlockTimestamp ?? 0,
    rank: rawPoolInfo.rank ?? 0,
  };

  // Add computed properties
  const hashrateFormatted = formatHashrate(poolInfo.estimatedHashrate);
  poolInfo.hashrateEH = hashrateFormatted.unit === 'EH/s' ? hashrateFormatted.value : 0;
  poolInfo.hashrateSharePercent = poolInfo.hashrateShare * 100;
  poolInfo.blockSharePercent = poolInfo.blockShare * 100;

  return poolInfo;
}

// Validation Functions

/**
 * Validate block object structure and data types
 * @param {Object} block - Block object to validate
 * @param {boolean} [throwOnError=false] - Whether to throw on validation failure
 * @returns {boolean} True if valid
 * @throws {Error} If invalid and throwOnError is true
 */
export function validateBlock(block, throwOnError = false) {
  if (!block || typeof block !== 'object') {
    if (throwOnError) {
      throw new Error('Block must be an object');
    }
    return false;
  }

  const required = ['id', 'height', 'timestamp', 'reward'];
  for (const field of required) {
    if (!(field in block)) {
      if (throwOnError) {
        throw new Error(`Block missing required field: ${field}`);
      }
      return false;
    }
  }

  if (typeof block.height !== 'number' || block.height < 0) {
    if (throwOnError) {
      throw new Error('Block height must be a non-negative number');
    }
    return false;
  }

  if (typeof block.timestamp !== 'number' || block.timestamp <= 0) {
    if (throwOnError) {
      throw new Error('Block timestamp must be a positive number');
    }
    return false;
  }

  if (typeof block.reward !== 'number' || block.reward < 0) {
    if (throwOnError) {
      throw new Error('Block reward must be a non-negative number');
    }
    return false;
  }

  return true;
}

/**
 * Validate pool info object structure and data types
 * @param {Object} poolInfo - Pool info object to validate
 * @param {boolean} [throwOnError=false] - Whether to throw on validation failure
 * @returns {boolean} True if valid
 * @throws {Error} If invalid and throwOnError is true
 */
export function validatePoolInfo(poolInfo, throwOnError = false) {
  if (!poolInfo || typeof poolInfo !== 'object') {
    if (throwOnError) {
      throw new Error('Pool info must be an object');
    }
    return false;
  }

  const required = ['id', 'name', 'slug', 'estimatedHashrate'];
  for (const field of required) {
    if (!(field in poolInfo)) {
      if (throwOnError) {
        throw new Error(`Pool info missing required field: ${field}`);
      }
      return false;
    }
  }

  if (typeof poolInfo.estimatedHashrate !== 'number' || poolInfo.estimatedHashrate < 0) {
    if (throwOnError) {
      throw new Error('Pool hashrate must be a non-negative number');
    }
    return false;
  }

  if (poolInfo.hashrateShare !== undefined) {
    if (typeof poolInfo.hashrateShare !== 'number' || poolInfo.hashrateShare < 0 || poolInfo.hashrateShare > 1) {
      if (throwOnError) {
        throw new Error('Pool hashrate share must be a number between 0 and 1');
      }
      return false;
    }
  }

  if (poolInfo.blockShare !== undefined) {
    // Allow NaN or invalid numbers to pass (they'll be handled as 0)
    if (typeof poolInfo.blockShare !== 'number' || isNaN(poolInfo.blockShare)) {
      if (throwOnError) {
        throw new Error('Pool block share must be a valid number');
      }
      return false;
    }
    // Clamp values outside 0-1 range instead of rejecting
    if (poolInfo.blockShare < 0 || poolInfo.blockShare > 1) {
      if (throwOnError) {
        throw new Error(`Pool block share must be a number between 0 and 1, got: ${poolInfo.blockShare}`);
      }
      return false;
    }
  }

  return true;
}

// Utility Functions

/**
 * Convert satoshi amount to BTC
 * @param {number} satoshis - Amount in satoshis
 * @returns {number} Amount in BTC (8 decimal places)
 */
export function satoshiToBTC(satoshis) {
  if (typeof satoshis !== 'number' || isNaN(satoshis)) {
    return 0;
  }
  return Number((satoshis / 100000000).toFixed(8));
}

/**
 * Format hashrate in H/s to human-readable format
 * @param {number} hashrate - Hashrate in H/s
 * @returns {{value: number, unit: string}} Formatted hashrate with value and unit
 */
export function formatHashrate(hashrate) {
  if (typeof hashrate !== 'number' || isNaN(hashrate) || hashrate < 0) {
    return { value: 0, unit: 'H/s' };
  }

  const EH = 1e18;
  const PH = 1e15;
  const TH = 1e12;
  const GH = 1e9;
  const MH = 1e6;
  const KH = 1e3;

  if (hashrate >= EH) {
    return { value: Number((hashrate / EH).toFixed(2)), unit: 'EH/s' };
  } else if (hashrate >= PH) {
    return { value: Number((hashrate / PH).toFixed(2)), unit: 'PH/s' };
  } else if (hashrate >= TH) {
    return { value: Number((hashrate / TH).toFixed(2)), unit: 'TH/s' };
  } else if (hashrate >= GH) {
    return { value: Number((hashrate / GH).toFixed(2)), unit: 'GH/s' };
  } else if (hashrate >= MH) {
    return { value: Number((hashrate / MH).toFixed(2)), unit: 'MH/s' };
  } else if (hashrate >= KH) {
    return { value: Number((hashrate / KH).toFixed(2)), unit: 'KH/s' };
  } else {
    return { value: Number(hashrate.toFixed(2)), unit: 'H/s' };
  }
}

/**
 * Calculate network hashrate from difficulty
 * Formula: H_network ≈ difficulty × 2^32 / 600
 * @param {number} difficulty - Network difficulty
 * @returns {number} Network hashrate in H/s
 */
export function calculateNetworkHashrate(difficulty) {
  if (typeof difficulty !== 'number' || isNaN(difficulty) || difficulty <= 0) {
    return 0;
  }
  // H_network ≈ difficulty × 2^32 / 600
  return (difficulty * Math.pow(2, 32)) / 600;
}


