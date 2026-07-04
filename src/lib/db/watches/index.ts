// Barrel for the watches data layer. Split into cohesive modules:
//   queries.ts   — read/list/search (with seed merge)
//   mutations.ts — insert/update/publish/pending writes
//   merge.ts     — shared seed-merge, source hydration, and suppression helpers
export type { SuppressedSeedMatches } from "@/lib/db/watches/merge";
export type { SubmissionWatchSlugs } from "@/lib/db/watches/mutations";

export {
  getEditableWatchBySlugs,
  getWatchById,
  getWatchBySlugs,
  listAdminWatches,
  listBrandWatches,
  listRecentWatches,
  listSearchWatches,
  listWatches,
  searchWatches
} from "@/lib/db/watches/queries";

export {
  findWatchId,
  findWatchIdById,
  findWatchIdByProductIdentity,
  getSubmissionWatchSlugs,
  insertApprovedSource,
  pendingWatch,
  publishWatch,
  unpublishWatch,
  updateWatch,
  updateWatchFromSubmission,
  upsertApprovedWatch
} from "@/lib/db/watches/mutations";
