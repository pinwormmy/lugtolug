import { describe, expect, it } from "vitest";
import {
  getEditableWatchBySlugs,
  getWatchBySlugs,
  listAdminWatches,
  listRecentWatches,
  pendingWatch,
  unpublishWatch,
  updateWatch
} from "@/lib/db/watches";
import type { SourceRow, WatchRow } from "@/lib/db/rows";

function createMockDb(watchRows: WatchRow[], sourceRows: SourceRow[] = []) {
  const prepareCalls: string[] = [];
  const bindCalls: unknown[][] = [];

  const db = {
    prepare(sql: string) {
      prepareCalls.push(sql);
      const statement = {
        bind(...args: unknown[]) {
          bindCalls.push(args);
          return statement;
        },
        async all() {
          if (sql.includes("FROM watches")) return { results: watchRows };
          if (sql.includes("FROM watch_sources")) return { results: sourceRows };
          throw new Error(`Unexpected query: ${sql}`);
        },
        async first() {
          if (sql.includes("FROM watches")) return watchRows[0] ?? null;
          throw new Error(`Unexpected query: ${sql}`);
        },
        async run() {
          return { meta: { last_row_id: 1 } };
        }
      };
      return statement;
    }
  };

  return { db: db as never, prepareCalls, bindCalls };
}

function watchRow(overrides: Partial<WatchRow>): WatchRow {
  return {
    id: overrides.id ?? 1,
    brand: overrides.brand ?? "Omega",
    model: overrides.model ?? "Speedmaster Professional",
    canonical_model: overrides.canonical_model ?? null,
    model_group: overrides.model_group ?? null,
    variant: overrides.variant ?? null,
    reference: overrides.reference ?? "310.30.42.50.01.001",
    brand_slug: overrides.brand_slug ?? "omega",
    model_slug: overrides.model_slug ?? "speedmaster-professional",
    reference_slug: overrides.reference_slug ?? "310-30-42-50-01-001",
    lug_to_lug_mm: overrides.lug_to_lug_mm ?? 47.5,
    case_mm: overrides.case_mm ?? 42,
    thickness_mm: overrides.thickness_mm ?? 13.2,
    lug_width_mm: overrides.lug_width_mm ?? 20,
    status: overrides.status ?? "approved",
    updated_at: overrides.updated_at ?? "2026-05-31T00:00:00.000Z"
  };
}

describe("recent watches", () => {
  it("orders the home feed by latest approval/update time", async () => {
    const { db, prepareCalls } = createMockDb([
      watchRow({
        id: 2,
        brand: "Zenith",
        model: "Chronomaster Sport",
        reference: "03.3114.3600/51.M3100",
        brand_slug: "zenith",
        model_slug: "chronomaster-sport",
        reference_slug: "03-3114-3600-51-m3100",
        updated_at: "2026-06-05T12:00:00.000Z"
      }),
      watchRow({
        id: 1,
        brand: "Audemars Piguet",
        model: "Royal Oak",
        reference: "15510ST.OO.1320ST.03",
        brand_slug: "audemars-piguet",
        model_slug: "royal-oak",
        reference_slug: "15510st-oo-1320st-03",
        updated_at: "2026-06-01T12:00:00.000Z"
      })
    ]);

    const recent = await listRecentWatches(db, 3);

    expect(prepareCalls[0]).toContain("ORDER BY updated_at DESC, id DESC LIMIT ?");
    expect(recent).toHaveLength(3);
    expect(recent[0].brand).toBe("Zenith");
    expect(recent[1].brand).toBe("Audemars Piguet");
  });

  it("includes recent seed additions when database approvals fill the home feed", async () => {
    const { db } = createMockDb([
      watchRow({ id: 10, brand: "Zenith", brand_slug: "zenith", updated_at: "2026-06-05T12:00:00.000Z" }),
      watchRow({
        id: 9,
        brand: "Audemars Piguet",
        brand_slug: "audemars-piguet",
        updated_at: "2026-06-04T12:00:00.000Z"
      }),
      watchRow({ id: 8, brand: "Tissot", brand_slug: "tissot", updated_at: "2026-06-03T12:00:00.000Z" }),
      watchRow({ id: 7, brand: "Omega", brand_slug: "omega", updated_at: "2026-06-02T12:00:00.000Z" }),
      watchRow({ id: 6, brand: "Seiko", brand_slug: "seiko", updated_at: "2026-06-01T12:00:00.000Z" })
    ]);

    const recent = await listRecentWatches(db, 5);

    expect(recent).toHaveLength(5);
    expect(recent.slice(0, 3).map((watch) => watch.brand)).toEqual(["Zenith", "Audemars Piguet", "Tissot"]);
    expect(recent.some((watch) => watch.brand === "Citizen" && watch.reference === "NJ0150-81Z")).toBe(true);
  });

  it("resolves editable watches by slugs instead of a public seed id", async () => {
    const { db, prepareCalls } = createMockDb([
      watchRow({
        id: 987,
        brand: "Cartier",
        model: "Santos de Cartier Medium",
        reference: "WSSA0029",
        brand_slug: "cartier",
        model_slug: "santos-de-cartier-medium",
        reference_slug: "wssa0029"
      })
    ]);

    const watch = await getEditableWatchBySlugs(db, "cartier", "santos-de-cartier-medium", "wssa0029");

    expect(prepareCalls[0]).toContain("WHERE brand_slug = ? AND model_slug = ? AND reference_slug = ?");
    expect(watch?.id).toBe(987);
    expect(watch?.reference).toBe("WSSA0029");
  });

  it("prefers pending editable watches over approved ones for the same slugs", async () => {
    const { db, prepareCalls } = createMockDb([
      watchRow({
        id: 10,
        brand: "Tissot",
        model: "Seastar 1000 Powermatic 80 43",
        reference: "T120.407.11.041.00",
        brand_slug: "tissot",
        model_slug: "seastar-1000-powermatic-80-43",
        reference_slug: "t120-407-11-041-00",
        status: "pending",
        updated_at: "2026-06-06T12:00:00.000Z"
      }),
      watchRow({
        id: 11,
        brand: "Tissot",
        model: "Seastar 1000 Powermatic 80 43",
        reference: "T120.407.11.041.00",
        brand_slug: "tissot",
        model_slug: "seastar-1000-powermatic-80-43",
        reference_slug: "t120-407-11-041-00",
        status: "approved",
        updated_at: "2026-06-05T12:00:00.000Z"
      })
    ]);

    const watch = await getEditableWatchBySlugs(db, "tissot", "seastar-1000-powermatic-80-43", "t120-407-11-041-00");

    expect(prepareCalls[0]).toContain("ORDER BY CASE WHEN status = 'approved' THEN 1 ELSE 0 END");
    expect(watch?.id).toBe(10);
    expect(watch?.status).toBe("pending");
  });

  it("keeps admin edits approved when saving changes", async () => {
    const { db, prepareCalls, bindCalls } = createMockDb([
      watchRow({
        id: 42,
        status: "approved"
      })
    ]);

    await updateWatch(db, 42, {
      brand: "Omega",
      model: "Speedmaster Professional",
      reference: "310.30.42.50.01.001",
      lugToLugMm: 47.5,
      caseMm: 42,
      thicknessMm: 13.2,
      lugWidthMm: 20,
      sourceUrl: "https://example.com/watch"
    });

    expect(prepareCalls[0]).toContain("status = ?");
    expect(bindCalls[0]).toContain("approved");
  });

  it("moves a watch to pending when explicitly unpublished", async () => {
    const { db, prepareCalls, bindCalls } = createMockDb([
      watchRow({
        id: 99,
        status: "approved"
      })
    ]);

    await unpublishWatch(db, 99);

    expect(prepareCalls[0]).toContain("SET status = 'pending'");
    expect(bindCalls[0]).toEqual([99]);
  });

  it("does not fall back to a public seed record when a matching pending row exists", async () => {
    const { db } = createMockDb([
      watchRow({
        brand: "Cartier",
        model: "Santos de Cartier Medium",
        reference: "WSSA0029",
        brand_slug: "cartier",
        model_slug: "santos-de-cartier-medium",
        reference_slug: "wssa0029",
        status: "pending"
      })
    ]);

    const watch = await getWatchBySlugs(db, "cartier", "santos-de-cartier-medium", "wssa0029");

    expect(watch).toBeNull();
  });

  it("creates a pending row when a seed record is explicitly unpublished", async () => {
    const { db, prepareCalls, bindCalls } = createMockDb([]);

    const watchId = await pendingWatch(db, {
      brand: "Cartier",
      model: "Santos de Cartier Medium",
      reference: "WSSA0029",
      lugToLugMm: 41.9,
      caseMm: 35.1,
      thicknessMm: 8.83,
      lugWidthMm: 16,
      sourceUrl: "https://example.com/cartier"
    });

    expect(watchId).toBe(1);
    expect(prepareCalls.some((sql) => sql.includes("INSERT INTO watches"))).toBe(true);
    expect(bindCalls.some((args) => args.includes("pending"))).toBe(true);
  });

  it("lists pending watches in the admin watch queue", async () => {
    const { db, prepareCalls } = createMockDb([
      watchRow({
        id: 77,
        brand: "Tissot",
        model: "Seastar 1000 Powermatic 80 43",
        reference: "T120.407.11.041.00",
        brand_slug: "tissot",
        model_slug: "seastar-1000-powermatic-80-43",
        reference_slug: "t120-407-11-041-00",
        status: "pending"
      })
    ]);

    const watches = await listAdminWatches(db, "pending");

    expect(prepareCalls[0]).toContain("status = 'pending' OR status = 'draft'");
    expect(watches).toHaveLength(1);
    expect(watches[0].status).toBe("pending");
    expect(watches[0].brand).toBe("Tissot");
  });
});
