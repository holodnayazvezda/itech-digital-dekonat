import {readFileSync, writeFileSync, existsSync} from "node:fs";
import {bookingCatalogFromMap} from "../shared/booking-catalog.js";

const path = file => new URL(file, import.meta.url);
const read = file => JSON.parse(readFileSync(file, "utf8"));
const catalog = bookingCatalogFromMap(read(path("../public/campus-map.json")));
const target = path("../shared/room-catalog.json");
const content = JSON.stringify(catalog, null, 1) + "\n";
if (!existsSync(target) || readFileSync(target, "utf8") !== content) writeFileSync(target, content);
// Import after writing the catalogue: its JSON is a dependency of the timetable.
await import("./sync-directory.js");
