// ── Profile completeness score ───────────────────────────────────────────────
export function profileCompletenessScore(student: {
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
