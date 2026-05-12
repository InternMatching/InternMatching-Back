import { calculateSkillOverlap, normalizeSkill } from "./skills.js";
import { textRelevanceScore, coverLetterScore } from "./textRelevance.js";
import { educationScore } from "./education.js";
import { profileCompletenessScore } from "./completeness.js";
import { WEIGHTS } from "./weights.js";

export { normalizeSkill, calculateSkillOverlap } from "./skills.js";

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
