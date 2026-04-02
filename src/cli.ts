import "dotenv/config";
import { resolveCliSamplePath, runTriageFromSamplePath } from "./run-sample.js";

const samplePath = resolveCliSamplePath(process.argv);
const report = await runTriageFromSamplePath(samplePath);

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
