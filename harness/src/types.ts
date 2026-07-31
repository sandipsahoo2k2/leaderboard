/**
 * Re-export of the shared vocabulary. The real definitions live in
 * shared/leaderboard-types.ts so the harness and the Angular app compile
 * against the exact same shapes — one file, not two that drift.
 */
export * from '../../shared/leaderboard-types.ts';
