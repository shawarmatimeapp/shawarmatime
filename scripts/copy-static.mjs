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
  "sw.js",
  "admin-order-alert.wav",
  "robots.txt",
  "sitemap.xml",
  "menu/index.html",
  "checkout/index.html",
  "track/index.html",
  "contact/index.html",
  "favicon-512x512.png",
  "og-image.png",
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
