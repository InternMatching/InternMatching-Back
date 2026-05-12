// ── Education relevance score ────────────────────────────────────────────────
export function educationScore(
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
