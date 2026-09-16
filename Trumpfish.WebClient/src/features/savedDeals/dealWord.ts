/**
 * "rozdanie", "rozdania" or "rozdań", whichever the count takes.
 */
/*
 * Its own module rather than a helper beside the list it is used in: a file that exports a component and a function is a
 * file React cannot refresh in place, and the rule is worth more than the extra file.
 */
export function dealWord(count: number): string {
  if (count === 1) {
    return 'rozdanie';
  }

  // Polish counts in threes: 2-4 take one form, everything else another, and the teens go with the majority.
  const tens = count % 100;
  const units = count % 10;
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? 'rozdania' : 'rozdań';
}
