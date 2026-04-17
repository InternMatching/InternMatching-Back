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

// ── Mongolian / English stopwords to ignore in text matching ──────────────────
const STOPWORDS = new Set([
  // English
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "had",
  "her",
  "was",
  "one",
  "our",
  "out",
  "has",
  "his",
  "how",
  "its",
  "may",
  "new",
  "now",
  "old",
  "see",
  "way",
  "who",
  "did",
  "get",
  "let",
  "say",
  "she",
  "too",
  "use",
  "with",
  "this",
  "that",
  "from",
  "have",
  "been",
  "will",
  "more",
  "when",
  "some",
  "them",
  "than",
  "each",
  "make",
  // Mongolian common
  "бол",
  "нь",
  "байх",
  "гэж",
  "тэр",
  "энэ",
  "юм",
  "мөн",
  "ба",
  "буюу",
  "бид",
  "тэд",
  "та",
  "би",
  "миний",
  "таны",
  "болон",
  "байна",
  "байсан",
]);

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

// ── Extract keywords from free text ──────────────────────────────────────────
function extractKeywords(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

// ── Text relevance score ─────────────────────────────────────────────────────
function textRelevanceScore(
  studentBio: string | undefined | null,
  studentSkills: string[],
  jobText: string,
): number {
  if (!jobText && !studentBio) return 0;

  const jobKeywords = new Set(extractKeywords(jobText));
  if (jobKeywords.size === 0) return 0;

  let score = 0;

  // Student skills mentioned in job free text
  const normalizedSkills = (studentSkills || []).map((s) => s.toLowerCase());
  for (const skill of normalizedSkills) {
    if (
      jobKeywords.has(skill) ||
      [...jobKeywords].some((kw) => kw.includes(skill) || skill.includes(kw))
    ) {
      score += 15;
    }
  }

  // Student bio keywords that appear in job text
  if (studentBio) {
    const bioKeywords = extractKeywords(studentBio);
    for (const bk of bioKeywords) {
      if (jobKeywords.has(bk)) {
        score += 3;
      }
    }
  }

  return Math.min(100, score);
}

// ── Education relevance score ────────────────────────────────────────────────
function educationScore(
  education:
    | Array<{ school: string; degree: string; year: number; status?: string }>
    | undefined
    | null,
  jobTitle: string | undefined | null,
  jobDescription: string | undefined | null,
  companyIndustry: string | undefined | null,
): number {
  if (!education || education.length === 0) return 0;

  let score = 0;
  const jobText = [jobTitle, jobDescription, companyIndustry]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const edu of education) {
    const degree = (edu.degree || "").toLowerCase();

    // Check if degree is relevant to the job
    const techKeywords = [
      "computer",
      "software",
      "programming",
      "information",
      "data",
      "мэдээлэл",
      "программ",
      "компьютер",
      "систем",
      "design",
      "дизайн",
      "graphic",
      "график",
      "business",
      "бизнес",
      "marketing",
      "маркетинг",
      "engineering",
      "инженер",
    ];

    const hasRelevantDegree = techKeywords.some(
      (kw) => degree.includes(kw) || jobText.includes(kw),
    );

    if (hasRelevantDegree) score += 50;

    // Status bonus
    if (edu.status === "studying") score += 25;
    if (edu.status === "graduated") score += 40;
  }

  return Math.min(100, score);
}

// ── Cover letter score ───────────────────────────────────────────────────────
function coverLetterScore(coverLetter: string | undefined | null): number {
  if (!coverLetter || coverLetter.trim().length === 0) return 0;
  const len = coverLetter.trim().length;
  if (len > 200) return 100;
  if (len > 100) return 75;
  if (len > 50) return 50;
  return 25;
}

// ── Profile completeness score ───────────────────────────────────────────────
function profileCompletenessScore(student: {
  bio?: string | null;
  skills?: string[] | null;
  education?: any[] | null;
  profilePictureUrl?: string | null;
  cvUrl?: string | null;
}): number {
  let score = 0;
  if (student.bio && student.bio.trim().length > 0) score += 20;
  if (student.skills && student.skills.length > 0) score += 25;
  if (student.education && student.education.length > 0) score += 20;
  if (student.profilePictureUrl) score += 15;
  if (student.cvUrl) score += 20;
  return score;
}

// ── Weights per perspective ──────────────────────────────────────────────────
const WEIGHTS = {
  student: {
    skills: 0.65,
    text: 0.15,
    education: 0.1,
    coverLetter: 0,
    completeness: 0.1,
  },
  company: {
    skills: 0.55,
    text: 0.15,
    education: 0.1,
    coverLetter: 0.15,
    completeness: 0.05,
  },
};

export function calculateMatchScore(
  student: {
    skills?: string[] | null;
    bio?: string | null;
    education?: Array<{
      school: string;
      degree: string;
      year: number;
      status?: string;
    }> | null;
    profilePictureUrl?: string | null;
    cvUrl?: string | null;
  },
  job: {
    requiredSkills?: string[] | null;
    title?: string | null;
    description?: string | null;
    requirements?: string | null;
    responsibilities?: string | null;
  },
  coverLetter: string | undefined | null,
  perspective: "student" | "company",
  companyIndustry?: string | null,
): number {
  const w = WEIGHTS[perspective];

  // 1. Skills overlap
  const skillResult = calculateSkillOverlap(
    student.skills || [],
    job.requiredSkills || [],
  );

  // 2. Text relevance
  const jobText = [job.description, job.requirements, job.responsibilities]
    .filter(Boolean)
    .join(" ");
  const textScore = textRelevanceScore(
    student.bio,
    student.skills || [],
    jobText,
  );

  // 3. Education
  const eduScore = educationScore(
    student.education,
    job.title,
    job.description,
    companyIndustry,
  );

  // 4. Cover letter (only matters for company perspective)
  const clScore = coverLetterScore(coverLetter);

  // 5. Profile completeness
  const profileScore = profileCompletenessScore(student);

  // Weighted sum
  const finalScore = Math.round(
    skillResult.score * w.skills +
      textScore * w.text +
      eduScore * w.education +
      clScore * w.coverLetter +
      profileScore * w.completeness,
  );

  return Math.max(0, Math.min(100, finalScore));
}
