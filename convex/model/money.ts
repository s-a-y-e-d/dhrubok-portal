export function assertMinorUnits(value: number, field = "amount") {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer in minor units`);
  }
  return value;
}

export function percentageDiscount(amountMinor: number, basisPoints: number) {
  assertMinorUnits(amountMinor);
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new Error("percentageBasisPoints must be between 0 and 10000");
  }
  return Math.round((amountMinor * basisPoints) / 10_000);
}
