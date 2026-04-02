import * as fs from "fs";
import * as path from "path";

export function resolveDataFile(filename: string): string {
  const fromSrc = path.join(process.cwd(), "src", "data", filename);
  const fromDist = path.join(process.cwd(), "dist", "data", filename);
  if (fs.existsSync(fromSrc)) return fromSrc;
  if (fs.existsSync(fromDist)) return fromDist;
  return fromSrc;
}
