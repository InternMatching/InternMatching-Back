const SKILL_ALIASES: Record<string, string> = {
  reactjs: "react",
  "react.js": "react",
  "react js": "react",
  nodejs: "nodejs",
  node: "nodejs",
  "node.js": "nodejs",
  "node js": "nodejs",
  js: "javascript",
  ts: "typescript",
  ux: "uiux",
  ui: "uiux",
  "ux design": "uiux",
  "ui design": "uiux",
  "ui/ux": "uiux",
  uiux: "uiux",
  "c#": "csharp",
  "c++": "cplusplus",
  cpp: "cplusplus",
  postgres: "postgresql",
  mongo: "mongodb",
  next: "nextjs",
  "next.js": "nextjs",
  nextjs: "nextjs",
  vue: "vuejs",
  "vue.js": "vuejs",
  vuejs: "vuejs",
  "angular.js": "angular",
  angularjs: "angular",
  "express.js": "express",
  expressjs: "express",
  tailwind: "tailwindcss",
  "tailwind css": "tailwindcss",
  tailwindcss: "tailwindcss",
  graphql: "graphql",
  gql: "graphql",
  python3: "python",
  py: "python",
  golang: "go",
  scss: "sass",
  aws: "aws",
  "amazon web services": "aws",
  gcp: "googlecloud",
  "google cloud": "googlecloud",
  docker: "docker",
  k8s: "kubernetes",
  ml: "machinelearning",
  "machine learning": "machinelearning",
  ai: "artificialintelligence",
  "artificial intelligence": "artificialintelligence",
  photoshop: "adobephotoshop",
  "adobe photoshop": "adobephotoshop",
  illustrator: "adobeillustrator",
  "adobe illustrator": "adobeillustrator",
  figma: "figma",
  sketch: "sketch",
};

// ── Normalize a skill string for comparison ──────────────────────────────────
export function normalizeSkill(skill: string): string {
  const lower = skill.toLowerCase().trim();

  // Check alias map first (before stripping)
  if (SKILL_ALIASES[lower]) return SKILL_ALIASES[lower];

  // Strip common suffixes
  const stripped = lower
    .replace(/\.js$/i, "")
    .replace(/\.ts$/i, "")
    .replace(/[.\-\/\s]+/g, "");

  // Check alias map again after stripping
  if (SKILL_ALIASES[stripped]) return SKILL_ALIASES[stripped];

  return stripped;
}

// ── Compare two skills, return match confidence (0, 0.5, or 1) ───────────────
function skillMatchConfidence(
  studentSkill: string,
  requiredSkill: string,
): number {
  const sNorm = normalizeSkill(studentSkill);
  const rNorm = normalizeSkill(requiredSkill);

  // Exact match after normalization
  if (sNorm === rNorm) return 1;

  // Substring containment (partial match)
  if (sNorm.length >= 3 && rNorm.length >= 3) {
    if (sNorm.includes(rNorm) || rNorm.includes(sNorm)) return 0.5;
  }

  return 0;
}

// ── Skills overlap with detailed breakdown ───────────────────────────────────
export function calculateSkillOverlap(
  studentSkills: string[],
  requiredSkills: string[],
): { score: number; matched: string[]; partial: string[]; missing: string[] } {
  if (!requiredSkills || requiredSkills.length === 0) {
    return { score: 50, matched: [], partial: [], missing: [] };
  }
  if (!studentSkills || studentSkills.length === 0) {
    return { score: 0, matched: [], partial: [], missing: [...requiredSkills] };
  }

  const matched: string[] = [];
  const partial: string[] = [];
  const missing: string[] = [];
  let totalScore = 0;

  for (const req of requiredSkills) {
    let bestMatch = 0;
    for (const stu of studentSkills) {
      const confidence = skillMatchConfidence(stu, req);
      bestMatch = Math.max(bestMatch, confidence);
      if (bestMatch === 1) break; // Can't do better
    }

    if (bestMatch === 1) {
      matched.push(req);
    } else if (bestMatch >= 0.5) {
      partial.push(req);
    } else {
      missing.push(req);
    }
    totalScore += bestMatch;
  }

  const score = (totalScore / requiredSkills.length) * 100;
  return { score, matched, partial, missing };
}
