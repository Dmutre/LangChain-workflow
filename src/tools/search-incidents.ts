import * as fs from "fs";
import {
  Category,
  SimilarIncident,
  SimilarIncidentSchema,
} from "../schemas/agent-validation.schema.js";
import { resolveDataFile } from "../data/resolve-data-path.js";
import { logger } from "../observability/logger.js";

interface RawIncident {
  id: string;
  title: string;
  category: string;
  severity: string;
  keywords: string[];
  resolved_in_minutes: number;
  resolution_summary: string;
}

function loadIncidents(): RawIncident[] {
  const filePath = resolveDataFile("incidents.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function scoreIncident(incident: RawIncident, keywords: string[], category: Category): number {
  let score = 0;

  if (incident.category === category) score += 10;

  const incidentKeywords = incident.keywords.map((k) => k.toLowerCase());
  for (const kw of keywords) {
    if (
      incidentKeywords.some((ik) => ik.includes(kw.toLowerCase()) || kw.toLowerCase().includes(ik))
    ) {
      score += 3;
    }
  }

  return score;
}

export async function searchSimilarIncidents(
  keywords: string[],
  category: Category,
  limit: number = 3
): Promise<SimilarIncident[]> {
  const start = Date.now();
  logger.toolCall("searchSimilarIncidents", { keywords, category, limit });

  try {
    const incidents = loadIncidents();

    const scored = incidents
      .map((inc) => ({ incident: inc, score: scoreIncident(inc, keywords, category) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const results: SimilarIncident[] = scored.map(({ incident }) =>
      SimilarIncidentSchema.parse(incident)
    );

    logger.toolResult(
      "searchSimilarIncidents",
      Date.now() - start,
      true,
      `Found ${results.length} similar incidents: ${results.map((r) => r.id).join(", ")}`
    );

    return results;
  } catch (err) {
    logger.toolResult("searchSimilarIncidents", Date.now() - start, false, undefined, String(err));
    return [];
  }
}
