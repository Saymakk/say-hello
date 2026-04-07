/**
 * Генерирует иконки сайта и PWA из public/sh.png.
 * Запуск: npm run icons
 */
import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "public/sh.png");

const out = [
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["public/apple-touch-icon.png", 180],
  ["public/favicon-32x32.png", 32],
  ["src/app/icon.png", 32],
];

async function main() {
  for (const [rel, size] of out) {
    const dest = join(root, rel);
    await mkdir(dirname(dest), { recursive: true });
    await sharp(src)
      .resize(size, size, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toFile(dest);
    console.log("wrote", rel);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
