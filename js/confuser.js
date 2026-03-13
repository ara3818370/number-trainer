// confuser.js — Number generation, confuser generation, yearToWords()
// This is the core algorithm module — quality of confusers = quality of trainer

// ── Helper arrays for yearToWords ──────────────────────────────────────────

const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
];

const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty',
  'sixty', 'seventy', 'eighty', 'ninety'
];

// ── yearToWords (TD-009) ───────────────────────────────────────────────────

/**
 * Convert a two-digit number (0–99) to English words.
 */
function twoDigitToWords(n) {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ' ' + ONES[o] : '');
}

/**
 * Convert a year (1100–2099) to spoken English words.
 * E.g. 1987 → "nineteen eighty seven", 2000 → "two thousand"
 * @param {number} year
 * @returns {string}
 */
export function yearToWords(year) {
  if (year === 2000) return 'two thousand';
  if (year >= 2001 && year <= 2009) return 'two thousand ' + ONES[year - 2000];

  const hi = Math.floor(year / 100);
  const lo = year % 100;
  const hiWords = twoDigitToWords(hi);

  if (lo === 0) return hiWords + ' hundred';
  if (lo < 10) return hiWords + ' oh ' + ONES[lo];
  return hiWords + ' ' + twoDigitToWords(lo);
}

// ── Random helpers ─────────────────────────────────────────────────────────

/**
 * Random integer in [min, max] inclusive.
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random element from an array.
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Target generation ──────────────────────────────────────────────────────

/**
 * Generate a target number for the given mode.
 * @param {'simple'|'years'|'large'|'mixed'} mode
 * @returns {number}
 */
export function generateTarget(mode) {
  switch (mode) {
    case 'simple': return randInt(1, 100);
    case 'years':  return randInt(1900, 2100);
    case 'large':  return randInt(100, 999999);
    case 'mixed':  return generateTarget(pick(['simple', 'years', 'large']));
    default:       return randInt(1, 100);
  }
}

// ── Explicit confuser table for small numbers 0–10 (ISSUE-002) ─────────────

const SMALL_NUMBER_CONFUSERS = {
  0:   [10, 8, 100],
  1:   [11, 10, 100],
  2:   [12, 20, 10],
  3:   [13, 30, 33],
  4:   [14, 40, 44],
  5:   [15, 50, 55],
  6:   [16, 60, 66],
  7:   [17, 70, 77],
  8:   [18, 80, 9],
  9:   [19, 90, 8],
  10:  [100, 1, 2],
};

// ── Classification ─────────────────────────────────────────────────────────

/**
 * Classify a number into trait categories for confuser strategy selection.
 */
function classify(target) {
  const traits = [];
  const digits = String(target);

  if (target >= 0 && target <= 10) traits.push('small');
  if (target >= 13 && target <= 19) traits.push('teen');
  if ([20,30,40,50,60,70,80,90].includes(target)) traits.push('ty');

  // Check for teen/ty component in compound numbers
  const lastTwo = target % 100;
  if (target > 19 && lastTwo >= 13 && lastTwo <= 19) traits.push('has_teen');
  if (target > 99 && [20,30,40,50,60,70,80,90].includes(lastTwo)) traits.push('has_ty');

  if (/[89]/.test(digits)) traits.push('eight_nine');
  if (/0/.test(digits) && target >= 10) traits.push('has_zero');
  if (target >= 1900 && target <= 2099) traits.push('year');
  if (target >= 100) traits.push('large');

  return traits;
}

// ── Confuser generation rules ──────────────────────────────────────────────

/**
 * Teen↔Ty swap: 13↔30, 14↔40, ... 19↔90.
 * For compound numbers: swap the last two digits' teen/ty.
 */
function teenTySwap(target) {
  const results = [];
  const lastTwo = target % 100;
  const base = target - lastTwo;

  // Direct teen↔ty swap for the number itself
  if (lastTwo >= 13 && lastTwo <= 19) {
    const tyVersion = (lastTwo % 10) * 10;
    results.push(base + tyVersion);
  }
  if ([20,30,40,50,60,70,80,90].includes(lastTwo)) {
    const teenVersion = (lastTwo / 10) + 10;
    results.push(base + teenVersion);
  }

  // For two-digit numbers in 11-19 range, also add the ty pair
  if (target >= 13 && target <= 19) {
    results.push((target % 10) * 10); // 13→30, 18→80
  }
  if (target >= 20 && target <= 90 && target % 10 === 0) {
    results.push((target / 10) + 10); // 30→13, 80→18
  }

  return results;
}

/**
 * Swap 8↔9 in each digit position.
 */
function eightNineSwap(target) {
  const results = [];
  const digits = String(target).split('');

  for (let i = 0; i < digits.length; i++) {
    if (digits[i] === '8') {
      const copy = [...digits];
      copy[i] = '9';
      results.push(Number(copy.join('')));
    } else if (digits[i] === '9') {
      const copy = [...digits];
      copy[i] = '8';
      results.push(Number(copy.join('')));
    }
  }

  return results;
}

/**
 * Swap 8/9 with 0.
 */
function eightNineZeroSwap(target) {
  const results = [];
  const digits = String(target).split('');

  for (let i = 0; i < digits.length; i++) {
    if (digits[i] === '8' || digits[i] === '9') {
      const copy = [...digits];
      copy[i] = '0';
      const num = Number(copy.join(''));
      if (num > 0) results.push(num);
    }
    if (digits[i] === '0' && i > 0) {
      const copy8 = [...digits];
      copy8[i] = '8';
      results.push(Number(copy8.join('')));
      const copy9 = [...digits];
      copy9[i] = '9';
      results.push(Number(copy9.join('')));
    }
  }

  return results;
}

/**
 * Decade shift: ±10, ±1 from number.
 */
function decadeShift(target) {
  return [target - 10, target + 10, target - 1, target + 1];
}

/**
 * Magnitude shift: ×10, ÷10, ±nearest hundred.
 */
function magnitudeShift(target) {
  const results = [target * 10, Math.floor(target / 10)];
  const hundred = Math.floor(target / 100) * 100;
  if (hundred !== target) results.push(hundred);
  results.push(hundred + 100);
  results.push(hundred - 100);
  return results;
}

/**
 * Phonetically similar for small/medium numbers.
 */
function phoneticSimilar(target) {
  return [target - 2, target - 1, target + 1, target + 2, target - 10, target + 10];
}

/**
 * Zero manipulation: rearrange, add, remove zeros.
 */
function zeroManipulation(target) {
  const results = [];
  const str = String(target);

  // ×10, ÷10
  results.push(target * 10);
  if (target >= 10) results.push(Math.floor(target / 10));

  // Rearrange zeros: move each zero to other positions
  const zeroPositions = [];
  const nonZeroPositions = [];
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '0') zeroPositions.push(i);
    else nonZeroPositions.push(i);
  }

  if (zeroPositions.length > 0) {
    // Swap zero with each non-zero digit (except leading)
    for (const zi of zeroPositions) {
      for (const ni of nonZeroPositions) {
        if (ni === 0 && str[zi] === '0') continue; // would create leading zero
        const arr = str.split('');
        [arr[zi], arr[ni]] = [arr[ni], arr[zi]];
        if (arr[0] !== '0') {
          results.push(Number(arr.join('')));
        }
      }
    }
  }

  return results;
}

// ── isZeroManipulation check (ISSUE-001) ───────────────────────────────────

function nonZeroDigits(n) {
  return String(n).replace(/0/g, '').split('').sort().join('');
}

function isZeroManipulation(candidate, target) {
  if (candidate === target * 10 || candidate === Math.floor(target / 10)) return true;
  if (nonZeroDigits(candidate) === nonZeroDigits(target)) return true;
  return false;
}

/**
 * Check if a confuser candidate is in a reasonable range for the mode.
 */
function isReasonable(candidate, mode, target) {
  if (candidate <= 0) return false;
  if (!Number.isInteger(candidate)) return false;

  // Zero-manipulation pairs are always allowed
  if (isZeroManipulation(candidate, target)) return true;

  switch (mode) {
    case 'simple': return candidate >= 1 && candidate <= 200;
    case 'years':  return candidate >= 1800 && candidate <= 2200;
    case 'large':  return candidate >= 1 && candidate <= 9999999;
    default:       return true;
  }
}

// ── Main confuser generation ───────────────────────────────────────────────

/**
 * Generate 3 confuser numbers for a given target.
 * @param {number} target - The correct number
 * @param {'simple'|'years'|'large'|'mixed'} mode
 * @returns {number[]} Array of exactly 3 confusers
 */
export function generateConfusers(target, mode) {
  // Fast path: explicit table for 0–10
  if (SMALL_NUMBER_CONFUSERS.hasOwnProperty(target)) {
    return [...SMALL_NUMBER_CONFUSERS[target]];
  }
  // Special case: 100
  if (target === 100) return [10, 1000, 110];

  const traits = classify(target);
  const candidates = [];

  // Select rule order based on has_zero trait (ISSUE-001)
  const hasZero = traits.includes('has_zero');
  const rules = hasZero
    ? [zeroManipulation, teenTySwap, eightNineSwap, eightNineZeroSwap, decadeShift, magnitudeShift, phoneticSimilar]
    : [teenTySwap, eightNineSwap, eightNineZeroSwap, decadeShift, magnitudeShift, phoneticSimilar, zeroManipulation];

  for (const rule of rules) {
    const generated = rule(target);
    for (const c of generated) {
      if (c !== target && c > 0 && isReasonable(c, mode, target) && !candidates.includes(c)) {
        candidates.push(c);
      }
    }
  }

  // Take top 3 by priority
  const result = candidates.slice(0, 3);

  // Fallback if we don't have enough
  const fallbackDeltas = [-2, -1, 1, 2, -10, 10, -5, 5, -20, 20];
  let fi = 0;
  while (result.length < 3 && fi < fallbackDeltas.length) {
    const fb = target + fallbackDeltas[fi];
    if (fb > 0 && fb !== target && !result.includes(fb)) {
      result.push(fb);
    }
    fi++;
  }

  return result;
}
