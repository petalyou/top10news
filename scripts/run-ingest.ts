/** Run the hourly pipeline locally. Usage: npm run ingest [-- YYYY-MM-DD-HH] */
import { parseHourKey } from "../lib/hour";
import { runHourlyIngest } from "../lib/ingest/pipeline";

const arg = process.argv[2];
const hour = arg ? parseHourKey(arg) : undefined;
if (arg && !hour) {
  console.error("Hour must be YYYY-MM-DD-HH (UTC)");
  process.exit(1);
}

runHourlyIngest({ hour: hour ?? undefined })
  .then(async (r) => {
    const json = JSON.stringify(r, null, 2);
    console.log(json);
    // CI reads the result from a file so feed/console logs can't corrupt it.
    if (process.env.RESULT_FILE) await (await import("node:fs/promises")).writeFile(process.env.RESULT_FILE, json);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
