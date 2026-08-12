export { getDb } from "@/lib/db/connection";
export {
  pendingWatch,
  getWatchById,
  getWatchBySlugs,
  getEditableWatchBySlugs,
  getWatchDirectoryStats,
  listAdminWatches,
  listBrandWatches,
  listPopularBrands,
  listRecentWatches,
  listRecentSearchWatches,
  listSearchWatches,
  listSimilarWatches,
  listWatches,
  publishWatch,
  searchWatches,
  unpublishWatch,
  updateWatch
} from "@/lib/db/watches";
export {
  approveSubmission,
  createSubmission,
  getApprovedSubmissionBySlugs,
  getSubmission,
  listSubmissions,
  rejectSubmission,
  returnSubmissionToPending,
  updateApprovedSubmission
} from "@/lib/db/submissions";
export { isSubmissionRateLimited, recordSubmissionRateLimit } from "@/lib/db/submissionRateLimits";
