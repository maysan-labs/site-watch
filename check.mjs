// Off-box content watchdog for maysanlabs.com. No dependencies, no business code: it only knows public URLs.
// Exit 0 = site is what it should be. Exit 1 = at least one assertion failed (details in probe.json).
import { writeFileSync } from "node:fs";

const PAGES = ["https://maysanlabs.com/", "https://maysanlabs.com/privacy", "https://maysanlabs.com/contact"];
const failures = [];
const ok = [];
const note = (cond, label, detail) => (cond ? ok.push(label) : failures.push(`${label}: ${detail}`));

const text = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

for (const url of PAGES) {
  let res, html = "";
  try {
    res = await fetch(url, { redirect: "follow", headers: { "user-agent": "maysan-site-watch" } });
    html = await res.text();
  } catch (e) {
    failures.push(`${url}: unreachable (${e.message})`);
    continue;
  }
  note(res.status === 200, `${url} status`, `got ${res.status}`);
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  note(title.trim().length > 10, `${url} title`, `title is "${title.trim()}"`);
  const h1s = html.match(/<h1[\s>]/gi) || [];
  note(h1s.length === 1, `${url} h1 count`, `found ${h1s.length} <h1> (expected exactly 1)`);
  const canon = (html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i) || [])[0] || "";
  note(canon.length > 0, `${url} canonical`, "no canonical tag");
  if (canon) note(canon.includes(new URL(url).pathname), `${url} self-canonical`, canon.slice(0, 120));
  const words = text(html).split(" ").filter(Boolean).length;
  // A skeleton/error shell renders a few dozen words; a real page renders hundreds.
  note(words > 150, `${url} visible words`, `only ${words} words (skeleton shell or error page)`);
}

// Deploy freshness: /api/health reports the built commit and time. A build that stops landing is silent
// otherwise - the site stays "up" while serving month-old code.
try {
  const h = await (await fetch("https://maysanlabs.com/api/health")).json();
  note(h.status === "ok", "/api/health status", `reports ${h.status}`);
  note(!!h.commit, "/api/health commit", "no commit reported");
  const ageD = (Date.now() - Date.parse(h.builtAt)) / 86400000;
  note(ageD < 21, "/api/health build age", `built ${ageD.toFixed(1)} days ago (deploys may have stopped landing)`);
  ok.push(`build ${h.commit} ${ageD.toFixed(1)}d old`);
} catch (e) {
  failures.push(`/api/health: ${e.message}`);
}

try {
  const sm = await (await fetch("https://maysanlabs.com/sitemap.xml")).text();
  const locs = sm.match(/<loc>[^<]+<\/loc>/g) || [];
  note(locs.length >= 5, "sitemap entries", `only ${locs.length} <loc> entries`);
  note(locs.every((l) => l.includes("maysanlabs.com")), "sitemap hosts", "a <loc> points outside maysanlabs.com");
} catch (e) {
  failures.push(`/sitemap.xml: ${e.message}`);
}

writeFileSync("probe.json", JSON.stringify({ ok, failures, checkedAt: new Date().toISOString() }, null, 2));
console.log(failures.length ? "FAILED:\n  " + failures.join("\n  ") : `all ${ok.length} assertions passed`);
process.exit(failures.length ? 1 : 0);
