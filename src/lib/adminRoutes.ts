import type { Watch } from "@/types";

export function getManagePublishedWatchHref(
  watch: Pick<Watch, "brandSlug" | "modelSlug" | "referenceSlug">
): string {
  return [
    "/admin/watches/manage",
    encodeURIComponent(watch.brandSlug),
    encodeURIComponent(watch.modelSlug),
    encodeURIComponent(watch.referenceSlug)
  ].join("/");
}
