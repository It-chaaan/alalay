import { client, throwIfError } from "./db.js";

/**
 * Processes due schedules inside the database. The SQL function locks each
 * schedule row and uses a unique occurrence key, so overlapping Render
 * instances and retries cannot post the same payday twice.
 */
export async function processIncomeSchedules() {
  const { data, error } = await client().rpc("process_due_income_schedules");
  throwIfError(error);
  return Number(data ?? 0);
}

export function startIncomeScheduler() {
  const run = () => void processIncomeSchedules()
    .then((count) => { if (count) console.log(`Income scheduler posted ${count} due occurrence(s).`); })
    .catch((error) => console.error("Income scheduler failed:", error));
  run();
  setInterval(run, 60 * 60 * 1000);
  console.log("Income scheduler enabled; running hourly.");
}
