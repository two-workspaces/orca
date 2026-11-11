// Password-gated page that hands out Orca pairing links, so nobody has to dig a
// credential out of the deploy logs. nginx routes /railway-pair here; everything
// else goes straight to Orca, whose per-device tokens protect the runtime.
// Orca mints pairing offers only at startup, so "new link" and "phone link" ask
// the entrypoint's supervisor loop to restart Orca with the right flags.
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { timingSafeEqual, createHash } from "node:crypto";

const password = process.env.ORCA_SETUP_PASSWORD;
if (!password) throw new Error("ORCA_SETUP_PASSWORD is required");
const STATE = process.env.ORCA_RAILWAY_STATE;
const digest = (s) => createHash("sha256").update(s).digest();
const want = digest(password);

const run = (cmd, args) =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout: 30000 }, (err, out) => (err ? reject(err) : resolve(out))),
  );
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const offer = (scope) => {
  try {
    return JSON.parse(readFileSync(`${STATE}/${scope}.json`, "utf8")).pairing;
  } catch {
    return null;
  }
};
const restart = (mode) => {
  writeFileSync(`${STATE}/next`, mode);
  return run("pkill", ["-TERM", "-f", "^/opt/orca/orca-ide .*--serve-port 6768"]).catch(() => {});
};
const qr = (text) => run("qrencode", ["-t", "SVG", "-m", "2", "-s", "5", "-o", "-", text]);

const page = (body) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pair with Orca</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem;color:#111;background:#fff}
a.btn,button{display:inline-block;padding:.6rem 1.1rem;background:#111;color:#fff;border:0;border-radius:.5rem;text-decoration:none;font:inherit;cursor:pointer}
button.ghost{background:#e5e5e5;color:#111}code{display:block;word-break:break-all;background:#f2f2f2;padding:.4rem .6rem;border-radius:.3rem;font-size:.8rem}
svg{width:15rem;height:auto}h2{margin-top:2rem}.mut{color:#666}form{display:inline}
@media(prefers-color-scheme:dark){body{background:#111;color:#eee}a.btn,button{background:#eee;color:#111}button.ghost{background:#333;color:#eee}code{background:#222}.mut{color:#999}}</style>
<h1>Pair a device with Orca</h1>${body}`;

createServer(async (req, res) => {
  const auth = req.headers.authorization ?? "";
  const given = auth.startsWith("Basic ")
    ? Buffer.from(auth.slice(6), "base64").toString().replace(/^[^:]*:/, "")
    : "";
  if (!timingSafeEqual(digest(given), want)) {
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Orca pairing", charset="UTF-8"' });
    return res.end("Password required: ORCA_SETUP_PASSWORD from the service's Variables tab.\n");
  }
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "same-origin" };
  try {
    if (req.method === "POST") {
      // Basic-auth credentials ride along on cross-site form posts; only accept our own page.
      // The page's Referrer-Policy must stay same-origin: under no-referrer browsers send
      // "Origin: null" even for our own form, which can't be told apart from a hostile page.
      const origin = req.headers.origin;
      if (origin && (origin === "null" || new URL(origin).host !== req.headers.host)) throw new Error("cross-origin POST");
      const action = new URL(req.url, "http://x").searchParams.get("action");
      if (action !== "reset" && action !== "mobile") throw new Error(`unknown action ${action}`);
      await restart(action);
      res.writeHead(303, { ...headers, Location: "/railway-pair?restarting=1" });
      return res.end();
    }
    const runtime = offer("runtime");
    const mobile = offer("mobile");
    const restarting = req.url.includes("restarting=1");
    let body = restarting
      ? `<p><b>Orca is restarting.</b> This takes about 20 seconds; <a href="/railway-pair">reload</a> then.</p>`
      : "";
    if (runtime?.url) {
      body += `<h2>Browser</h2><p><a class="btn" href="${esc(runtime.webClientUrl)}">Open Orca in this browser</a></p>
<p class="mut">The link signs the browser in. Bookmark the page it opens, or come back here.</p>
<h2>Orca desktop app</h2><p>Settings &rarr; Remote Orca Servers &rarr; Add Server, then paste:</p><code>${esc(runtime.url)}</code>`;
    } else if (!restarting) {
      body += `<p>Orca has not published a pairing link yet. It is still starting; reload in a few seconds.</p>`;
    }
    body += `<h2>Orca phone app</h2>`;
    body += mobile?.url
      ? `<p>In the Orca app choose <b>Pair</b> and scan:</p>${await qr(mobile.url)}<code>${esc(mobile.url)}</code>`
      : `<p class="mut">The phone app needs its own link. Creating one restarts Orca for a few seconds; running agents keep going.</p>
<form method="post" action="/railway-pair?action=mobile"><button class="ghost">Create a phone-app link</button></form>`;
    body += `<h2>Sign out every device</h2><p class="mut">Revokes every link and every paired browser, app and phone, then makes a fresh link. Orca restarts for a few seconds.</p>
<form method="post" action="/railway-pair?action=reset" onsubmit="return confirm('Sign out every paired device?')"><button class="ghost">Revoke all and make a new link</button></form>
<p class="mut">These links are credentials. Anyone holding one can run commands on this server.</p>`;
    res.writeHead(200, { ...headers, "Content-Type": "text/html; charset=utf-8" });
    res.end(page(body));
  } catch (err) {
    console.error("railway-pair:", err.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Something went wrong; see the deploy logs.\n");
  }
}).listen(6769, "127.0.0.1");
