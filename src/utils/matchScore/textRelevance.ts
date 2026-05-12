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
export function textRelevanceScore(
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

// ── Cover letter score ───────────────────────────────────────────────────────
export function coverLetterScore(coverLetter: string | undefined | null): number {
  if (!coverLetter || coverLetter.trim().length === 0) return 0;
  const len = coverLetter.trim().length;
  if (len > 200) return 100;
  if (len > 100) return 75;
  if (len > 50) return 50;
  return 25;
}
