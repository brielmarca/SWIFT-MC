import process from "node:process";
import sharp from "sharp";
import { stat } from "node:fs/promises";

// Explicit source list: never modifies the original design exports.
const sources = ["emblem.png", "enderman.png", ...["swift", "eclipse", "cosmic", "overdrive"].map(name => `ranks/${name}-v2.jpeg`)];
for (const source of sources) {
  const input = `public/brand/${source}`;
  const output = input.replace(/\.(png|jpeg)$/, ".webp");
  await sharp(input).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 85, effort: 6 }).toFile(output);
  process.stdout.write(`${output}: ${(await stat(input)).size} → ${(await stat(output)).size} bytes\n`);
}
