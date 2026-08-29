import fs from "node:fs";
import webpush from "web-push";

const envPath = process.argv[2] || ".env";
const source = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const readValue = (key) => source.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim() || "";

if (readValue("VAPID_PUBLIC_KEY") && readValue("VAPID_PRIVATE_KEY")) {
  console.log("Web Push keys already configured.");
  process.exit(0);
}

const keys = webpush.generateVAPIDKeys();
const updates = {
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: readValue("VAPID_SUBJECT") || "mailto:notifications@agodly.com"
};
const updateNames = new Set(Object.keys(updates));
const retained = source.split(/\r?\n/).filter((line) => !updateNames.has(line.split("=", 1)[0]));
const output = [...retained.filter(Boolean), ...Object.entries(updates).map(([key, value]) => `${key}=${value}`), ""].join("\n");
const temporaryPath = `${envPath}.push-keys.tmp`;
fs.writeFileSync(temporaryPath, output, { mode: 0o600 });
fs.renameSync(temporaryPath, envPath);
fs.chmodSync(envPath, 0o600);
console.log("Generated persistent Web Push keys without exposing them in output.");
