/**
 * Soft daily request cap for the hosted demo endpoint.
 *
 * In-memory per-instance counter, reset at UTC midnight. With Cloud Run's
 * `maxInstances: 3` and roughly-even load balancing this produces an
 * effective cap of ~PER_INSTANCE_CAP × maxInstances total requests per day
 * (± instance churn / uneven distribution).
 *
 * Not a hard global cap. Instances that get recycled mid-day reset their
 * bucket on the next request — worst case the demo serves somewhat more
 * than the configured total before manual intervention. That's acceptable
 * for the cost posture documented in the README.
 */

import type { Request, Response, NextFunction } from 'express';

export const PER_INSTANCE_CAP = 25_000;

let bucketDate = todayUtc();
let bucketCount = 0;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dailyCap(_req: Request, res: Response, next: NextFunction): void {
  const today = todayUtc();
  if (today !== bucketDate) {
    bucketDate = today;
    bucketCount = 0;
  }
  if (bucketCount >= PER_INSTANCE_CAP) {
    res.status(429).json({
      error: 'Daily demo quota reached — try again tomorrow or deploy your own copy.',
    });
    return;
  }
  bucketCount++;
  next();
}

/** Test-only: read the current bucket state. */
export function _bucketState(): { date: string; count: number } {
  return { date: bucketDate, count: bucketCount };
}

/** Test-only: reset the bucket counter. */
export function _resetBucket(): void {
  bucketDate = todayUtc();
  bucketCount = 0;
}
