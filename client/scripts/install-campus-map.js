import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { parseAtlas } from "../src/features/navigation/campus-map.js";
import { bookingCatalogFromMap } from "../src/shared/domain/booking-catalog.js";

const [command, source, directory, ...extra] = process.argv.slice(2);
try {
  if (!source || extra.length || !(command === "check" && !directory || command === "install" && directory)) {
    throw new Error("Использование: check <карта.json> или install <карта.json> <каталог статики>");
  }
  const content = await readFile(source, "utf8");
  const atlas = parseAtlas(JSON.parse(content));
  bookingCatalogFromMap(atlas);
  if (command === "install") {
    const target = join(directory, "campus-map.json");
    const temp = join(directory, ".campus-map-" + randomUUID() + ".tmp");
    try {
      await writeFile(temp, content, {flag:"wx", mode:0o644});
      await rename(temp, target);
    } finally {
      await unlink(temp).catch(error => { if (error.code !== "ENOENT") throw error; });
    }
    console.log("Карта установлена:", target);
  } else {
    console.log("Карта проверена:", basename(source));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
