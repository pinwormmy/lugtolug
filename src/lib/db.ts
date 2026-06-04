export { getDb } from "@/lib/db/connection";
export {
  getWatchById,
  getWatchBySlugs,
  listBrandWatches,
  listRecentWatches,
  listWatches,
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
