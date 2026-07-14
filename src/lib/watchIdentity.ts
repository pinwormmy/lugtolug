import type { Watch } from "@/types";
import { compactReference } from "@/lib/watchText";

export { compactReference };

export interface WatchReferenceIdentityParts {
  brandSlug: string;
  reference: string;
}

export function hasProductNumberIdentity(reference: string): boolean {
  const compact = compactReference(reference);
  return compact.length >= 3 && /\d/.test(compact);
}

export function getReferenceProductIdentity(
  watch: WatchReferenceIdentityParts | Pick<Watch, "brandSlug" | "reference">
): string | null {
  const compact = compactReference(watch.reference);
  if (compact.length < 3 || !/\d/.test(compact)) return null;

  return `${watch.brandSlug}|${compact}`;
}
