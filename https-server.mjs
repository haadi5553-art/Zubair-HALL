/**
 * OPTIONAL HTTPS server for Zubair Hall Mess Manager.
 * Only use this if you created a certificate (see README, "Optional HTTPS").
 * Usage:  npm run start:https
 */
import { createServer } from "node:https";
import { readFileSync, existsSync } from "node:fs";
import { parse } from "node:url";
import next from "next";

const port = Number(process.env.PORT || 3000);
const keyFile = process.env.SSL_KEY_FILE || "./certs/key.pem";
const certFile = process.env.SSL_CERT_FILE || "./certs/cert.pem";

if (!existsSync(keyFile) || !existsSync(certFile)) {
  console.error("");
  console.error("HTTPS certificate files were not found:");
  console.error(`  key:  ${keyFile}`);
  console.error(`  cert: ${certFile}`);
  console.error("");
  console.error("Create them first, e.g. with mkcert:");
  console.error("  mkcert -install");
  console.error("  mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 192.168.1.50");
  console.error("(replace 192.168.1.50 with your PC's IPv4 address from `ipconfig`)");
  console.error("");
  process.exit(1);
}

const app = next({ dev: false });
const handle = app.getRequestHandler();

await app.prepare();

createServer(
  { key: readFileSync(keyFile), cert: readFileSync(certFile) },
  (req, res) => handle(req, res, parse(req.url, true)),
).listen(port, () => {
  console.log(`✅ Zubair Hall Mess Manager running over HTTPS:  https://localhost:${port}`);
});
