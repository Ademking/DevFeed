// Packages the built extension for each store:
//
//   npm run package
//
// Expects dist/ from `npm run build`. Writes:
//   dist-firefox/                        unpacked Firefox build
//   release/devfeed-chrome-v<version>.zip  Chrome Web Store / Edge / Brave
//   release/devfeed-firefox-v<version>.zip addons.mozilla.org
//
// The zip writer is built in so archives always use forward slashes, which
// stores and macOS/Linux unzip require (Windows PowerShell 5.1 uses backslashes).

import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { deflateRawSync } from "node:zlib";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const dist = join(root, "dist");
const distFirefox = join(root, "dist-firefox");
const releaseDir = join(root, "release");

// ---------- Firefox manifest ----------

// Chrome-only permissions that Firefox would flag as unknown.
const CHROME_ONLY_PERMISSIONS = new Set(["favicon"]);

const firefoxManifest = (manifest) => ({
  ...manifest,
  permissions: manifest.permissions.filter((p) => !CHROME_ONLY_PERMISSIONS.has(p)),
  browser_specific_settings: {
    gecko: {
      id: "devfeed@ademking.github.io",
      // data_collection_permissions needs Firefox 140+.
      strict_min_version: "140.0",
      // The daily.dev token is sent to daily.dev; the weather location is sent
      // to Open-Meteo (and, as a fallback, the IP address to GeoJS).
      data_collection_permissions: {
        required: ["authenticationInfo", "locationInfo"],
      },
    },
  },
});

// ---------- zip writer ----------

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// Fixed timestamp (2026-01-01) so the same build gives the same zip.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const listFiles = async (dir) => {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else out.push(full);
  }
  return out;
};

const writeZip = async (sourceDir, zipPath) => {
  // manifest.json first, then everything else in a stable order.
  const files = (await listFiles(sourceDir))
    .map((f) => ({ full: f, name: relative(sourceDir, f).split(sep).join("/") }))
    .sort((a, b) => (a.name === "manifest.json" ? -1 : b.name === "manifest.json" ? 1 : a.name.localeCompare(b.name)));

  const local = [];
  const central = [];
  let offset = 0;
  for (const { full, name } of files) {
    const data = await readFile(full);
    const compressed = deflateRawSync(data, { level: 9 });
    const useDeflate = compressed.length < data.length;
    const body = useDeflate ? compressed : data;
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // UTF-8 names
    header.writeUInt16LE(useDeflate ? 8 : 0, 8);
    header.writeUInt16LE(DOS_TIME, 10);
    header.writeUInt16LE(DOS_DATE, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, nameBuf, body);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4); // version made by
    dir.writeUInt16LE(20, 6); // version needed
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(useDeflate ? 8 : 0, 10);
    dir.writeUInt16LE(DOS_TIME, 12);
    dir.writeUInt16LE(DOS_DATE, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);

    offset += header.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  await writeFile(zipPath, Buffer.concat([...local, centralBuf, end]));
  const { size } = await stat(zipPath);
  console.log(`${relative(root, zipPath)}  ${files.length} files, ${(size / 1024 / 1024).toFixed(2)} MB`);
};

// ---------- main ----------

const manifest = JSON.parse(await readFile(join(dist, "manifest.json"), "utf8"));
const { version } = manifest;

await rm(distFirefox, { recursive: true, force: true });
await cp(dist, distFirefox, { recursive: true });
await writeFile(
  join(distFirefox, "manifest.json"),
  `${JSON.stringify(firefoxManifest(manifest), null, 2)}\n`
);
console.log("dist-firefox/  Firefox build");

await mkdir(releaseDir, { recursive: true });
await writeZip(dist, join(releaseDir, `devfeed-chrome-v${version}.zip`));
await writeZip(distFirefox, join(releaseDir, `devfeed-firefox-v${version}.zip`));
