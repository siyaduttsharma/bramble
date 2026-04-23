/**
 * Calculate Shannon Entropy of a string
 */
export function calculateEntropy(str: string): number {
  if (!str) return 0;
  const len = str.length;
  const freq: Record<string, number> = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }
  // Normalize to 0-1 range (roughly, for short strings)
  return Math.min(1, entropy / 4);
}

/**
 * Common formatting utilities
 */
export const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};

export const formatId = (id: string) => {
  if (!id) return '';
  return id.slice(0, 4) + '...' + id.slice(-4);
};
