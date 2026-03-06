/**
 * Prevents duplicate processing of the same barcode within a short timeframe.
 */
export class DuplicateGuard {
  private lastScannedCode: string | null = null;
  private lastScannedTime: number = 0;
  private readonly cooldownMs: number;

  constructor(cooldownMs: number = 1500) {
    this.cooldownMs = cooldownMs;
  }

  /**
   * Checks if the barcode is a duplicate scan.
   * @param barcode The barcode to check
   * @returns true if it's a duplicate scan within the cooldown period
   */
  isDuplicate(barcode: string): boolean {
    const now = Date.now();
    if (
      this.lastScannedCode === barcode &&
      now - this.lastScannedTime < this.cooldownMs
    ) {
      return true;
    }
    
    this.lastScannedCode = barcode;
    this.lastScannedTime = now;
    return false;
  }

  reset() {
    this.lastScannedCode = null;
    this.lastScannedTime = 0;
  }
}
