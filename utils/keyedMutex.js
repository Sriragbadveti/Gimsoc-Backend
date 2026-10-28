// Tiny in-process keyed mutex. Requests that compete for the same key run one after another
// instead of all starting a MongoDB transaction at once and aborting/retrying each other.
// It is only a performance measure: correctness across multiple server instances still comes
// from the transactional lock documents in ticketLimits.js.
const tails = new Map();

async function withKeys(keys, fn) {
  const sorted = [...new Set(keys)].sort(); // fixed order -> no deadlocks
  const releases = [];
  try {
    for (const key of sorted) {
      const prev = tails.get(key) || Promise.resolve();
      let release;
      const mine = new Promise((r) => (release = r));
      const tail = prev.then(() => mine);
      tails.set(key, tail);
      await prev;
      releases.push(() => {
        release();
        if (tails.get(key) === tail) tails.delete(key);
      });
    }
    return await fn();
  } finally {
    releases.reverse().forEach((r) => r());
  }
}

module.exports = { withKeys };
