/** Prints the hour key (UTC, YYYY-MM-DD-HH) the next scheduled ingest run will build. */
import { targetHourFor } from "../lib/ingest/pipeline";
import { toHourKey } from "../lib/hour";

console.log(toHourKey(targetHourFor(new Date())));
