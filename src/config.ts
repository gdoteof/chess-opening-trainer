/**
 * Every tunable number in the trainer lives here.
 */
export const config = {
  quality: {
    /** Centipawn loss (best score minus move score) at or below which a move is green. */
    greenMaxLoss: 30,
    yellowMaxLoss: 100,
    orangeMaxLoss: 200,
    /**
     * Scores are clamped to ±this many centipawns (mate counts as the clamp value) before
     * losses are computed, so that in an already-decisive position a move that keeps a
     * decisive advantage is not flagged as a blunder. Use Infinity for raw centipawn losses.
     */
    evalCapCp: 1000,
  },

  analysis: {
    targetDepth: 18,
    timeBudgetMs: 3000,
    /** Below this depth destinations are shown as "still thinking" and moves are not judged. */
    minDepth: 10,
  },

  engine: {
    /**
     * 'lite' (≈2 MB, loads instantly, still far stronger than any human) or
     * 'full' (≈95 MB download, the full-size network).
     */
    flavor: 'lite' as 'lite' | 'full',
    hashMb: 64,
    maxThreads: 8,
  },

  mate: {
    /** A mate score becomes ±(this − moves to mate) when compared with centipawn scores. */
    scoreBase: 10000,
  },

  bot: {
    minRating: 400,
    maxRating: 2800,
    ratingStep: 50,
    defaultRating: 1000,
    /** The bot never replies faster than this, so its moves don't appear instantly. */
    minThinkMs: 700,
    /**
     * Rated bots move once analysis reaches this depth rather than waiting out the full
     * budget; their sampling swamps the difference. "Max" always waits for the full search.
     */
    ratedMinDepth: 14,
  },

  drill: {
    /** Pause before the book opponent replies. */
    replyDelayMs: 450,
    /** Pause on a finished line before the next one starts. */
    nextLineDelayMs: 2000,
  },

  proof: {
    plyIntervalMs: 800,
    /** Refutation plies played after the player's move before the proof stops. */
    maxPlies: 12,
    /** A material drop of at least this much (centipawns) ends the proof as "loses material". */
    materialDropCp: 200,
    /** At the ply limit, a smaller drop than this is "roughly even" material. */
    roughlyEvenCp: 100,
    /** When the stored line runs out, the continuation is taken once analysis reaches this depth. */
    extensionDepth: 14,
  },
}
