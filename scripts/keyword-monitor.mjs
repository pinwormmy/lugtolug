#!/usr/bin/env node
// Detect new Reddit posts mentioning the configured keywords, so replies stay
// manual while detection stays automatic. Only post search is covered here;
// for comment mentions pair this with a free F5Bot subscription.
//
// Usage:
//   node scripts/keyword-monitor.mjs              # report new mentions since last run
//   node scripts/keyword-monitor.mjs --reset      # forget seen posts and start fresh
//
// Env:
//   KEYWORD_MONITOR_WEBHOOK  optional Discord-compatible webhook URL; each new
//                            mention is POSTed as {"content": "..."}.
//
// State lives in data/keyword-monitor.state.json (gitignored); config in
// data/keyword-monitor.config.json.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const CONFIG_PATH = path.join(DATA_DIR, "keyword-monitor.config.json");
const STATE_PATH = path.join(DATA_DIR, "keyword-monitor.state.json");
const USER_AGENT = "lugtolug-finder keyword monitor (contact: eolthemind@gmail.com)";
const MAX_SEEN_IDS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// Reddit's JSON endpoints reject unauthenticated clients (HTTP 403), but the
// Atom feeds stay open, so mentions are read from search.rss instead.
async function searchReddit(query, subreddit, limit) {
  const params = new URLSearchParams({ q: query, sort: "new", limit: String(limit), t: "week" });
  let url;
  if (subreddit) {
    params.set("restrict_sr", "1");
    url = `https://www.reddit.com/r/${subreddit}/search.rss?${params}`;
  } else {
    url = `https://www.reddit.com/search.rss?${params}`;
  }
  let response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (response.status === 429) {
    // Unauthenticated Reddit allows roughly 10 requests/minute per IP.
    await sleep(30000);
    response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  }
  if (!response.ok) {
    console.warn(`  Reddit search failed for ${subreddit ? `r/${subreddit} ` : ""}"${query}": HTTP ${response.status}`);
    return [];
  }
  const xml = await response.text();
  const posts = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = /<id>([^<]+)<\/id>/.exec(entry)?.[1] ?? "";
    if (!id.startsWith("t3_")) continue; // posts only; search also returns subreddit (t5_) results
    posts.push({
      name: id,
      title: decodeEntities(/<title>([\s\S]*?)<\/title>/.exec(entry)?.[1] ?? "(no title)"),
      url: /<link href="([^"]+)"/.exec(entry)?.[1] ?? "",
      subreddit: /<category term="([^"]+)"/.exec(entry)?.[1] ?? "?",
      updatedAt: /<updated>([^<]+)<\/updated>/.exec(entry)?.[1] ?? ""
    });
  }
  return posts;
}

function formatMention(post, keyword) {
  return [
    `[r/${post.subreddit}] ${post.title}`,
    `  keyword: ${keyword} | ${post.updatedAt}`,
    `  ${post.url}`
  ].join("\n");
}

async function notifyWebhook(webhookUrl, text) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: text.slice(0, 1900) })
  });
  if (!response.ok) console.warn(`  Webhook notification failed: HTTP ${response.status}`);
}

async function main() {
  if (process.argv.includes("--reset") && existsSync(STATE_PATH)) {
    writeFileSync(STATE_PATH, JSON.stringify({ seenIds: [] }, null, 2));
    console.log("State reset.");
  }

  const config = loadJson(CONFIG_PATH, null);
  if (!config?.keywords?.length) throw new Error(`Missing keywords in ${CONFIG_PATH}`);
  const state = loadJson(STATE_PATH, { seenIds: [] });
  const seen = new Set(state.seenIds);
  const limit = config.limitPerQuery ?? 25;

  // Search globally per keyword, then per configured subreddit for better recall
  // (Reddit's global search misses some subreddit posts).
  const queries = config.keywords.flatMap((keyword) => [
    { keyword, subreddit: null },
    ...(config.subreddits ?? []).map((subreddit) => ({ keyword, subreddit }))
  ]);

  const fresh = [];
  for (const { keyword, subreddit } of queries) {
    const posts = await searchReddit(keyword, subreddit, limit);
    for (const post of posts) {
      if (seen.has(post.name) || fresh.some((entry) => entry.post.name === post.name)) continue;
      fresh.push({ post, keyword });
    }
    // Stay under Reddit's unauthenticated rate limit (~10 requests/minute).
    await sleep(8000);
  }

  fresh.sort((a, b) => b.post.updatedAt.localeCompare(a.post.updatedAt));
  const isFirstRun = state.seenIds.length === 0;

  if (fresh.length === 0) {
    console.log("No new mentions.");
  } else if (isFirstRun) {
    console.log(`First run: baselined ${fresh.length} existing mention(s) without notifying.`);
  } else {
    console.log(`${fresh.length} new mention(s):\n`);
    const webhook = process.env.KEYWORD_MONITOR_WEBHOOK;
    for (const { post, keyword } of fresh) {
      const text = formatMention(post, keyword);
      console.log(`${text}\n`);
      if (webhook) await notifyWebhook(webhook, text);
    }
  }

  const seenIds = [...fresh.map((entry) => entry.post.name), ...state.seenIds].slice(0, MAX_SEEN_IDS);
  writeFileSync(STATE_PATH, JSON.stringify({ seenIds, lastRunAt: new Date().toISOString() }, null, 2));
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
