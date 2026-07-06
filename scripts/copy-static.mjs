import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const files = [
  "404.html",
  "favicon.ico",
  "favicon.svg",
  "favicon-32x32.png",
  "favicon-192x192.png",
  "apple-touch-icon.png",
  "site.webmanifest",
  "admin-order-alert.wav",
  "robots.txt",
  "sitemap.xml",
  "track/index.html",
  ".nojekyll"
];

await mkdir("dist", { recursive: true });

await Promise.all(files.map(async (file) => {
  try {
    await stat(file);
    const target = join("dist", file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(file, target);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}));
