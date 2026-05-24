import AIMatchCache, {
  IAIMatchCache,
} from "../modules/ai-match-cache/aiMatchCache.model.js";
import { getAIMatchScore, AIMatchResult } from "./aiMatchScore.js";

type StudentLike = {
  _id: any;
  updatedAt?: Date;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  skills?: string[] | null;
  education?:
    | { school: string; degree: string; year: number; status?: string }[]
    | null;
  experienceLevel?: string | null;
};

type JobLike = {
  _id: any;
  updatedAt?: Date;
  title: string;
  requiredSkills?: string[] | null;
  description?: string | null;
  requirements?: string | null;
  responsibilities?: string | null;
};

export interface CachedAIMatch extends AIMatchResult {
  cached: boolean;
}

function isFresh(
  cache: Pick<IAIMatchCache, "studentProfileUpdatedAt" | "jobUpdatedAt">,
  studentUpdatedAt: Date | undefined,
  jobUpdatedAt: Date | undefined,
): boolean {
  if (!studentUpdatedAt || !jobUpdatedAt) return false;
  return (
    cache.studentProfileUpdatedAt.getTime() >= studentUpdatedAt.getTime() &&
    cache.jobUpdatedAt.getTime() >= jobUpdatedAt.getTime()
  );
}

function toResult(cache: IAIMatchCache): CachedAIMatch {
  return {
    score: cache.score,
    summary: cache.summary,
    strengths: cache.strengths,
    gaps: cache.gaps,
    recommendation: cache.recommendation,
    cached: true,
  };
}

async function persist(
  studentId: any,
  jobId: any,
  studentUpdatedAt: Date,
  jobUpdatedAt: Date,
  result: AIMatchResult,
): Promise<void> {
  await AIMatchCache.findOneAndUpdate(
    { studentProfileId: studentId, jobId },
    {
      $set: {
        score: result.score,
        summary: result.summary,
        strengths: result.strengths,
        gaps: result.gaps,
        recommendation: result.recommendation,
        studentProfileUpdatedAt: studentUpdatedAt,
        jobUpdatedAt: jobUpdatedAt,
        computedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
}

// Single student + single job: return cached if fresh, otherwise call Claude
// and save. Used by the on-demand AI panel and by createApplication.
export async function getOrComputeAIMatch(
  student: StudentLike,
  job: JobLike,
): Promise<CachedAIMatch> {
  const studentUpdatedAt = student.updatedAt;
  const jobUpdatedAt = job.updatedAt;

  const existing = await AIMatchCache.findOne({
    studentProfileId: student._id,
    jobId: job._id,
  });

  if (existing && isFresh(existing, studentUpdatedAt, jobUpdatedAt)) {
    return toResult(existing);
  }

  const fresh = await getAIMatchScore(student, job);

  if (studentUpdatedAt && jobUpdatedAt) {
    await persist(student._id, job._id, studentUpdatedAt, jobUpdatedAt, fresh);
  }

  return { ...fresh, cached: false };
}

// Bulk variant: scores N jobs for one student in parallel, reading the cache
// in one query and only calling Claude for stale/missing entries. Failures
// per-job are swallowed so one bad Claude call can't kill the page; that job
// just returns null.
export async function getOrComputeAIMatchBatch(
  student: StudentLike,
  jobs: JobLike[],
): Promise<Map<string, CachedAIMatch | null>> {
  const out = new Map<string, CachedAIMatch | null>();
  if (jobs.length === 0) return out;

  const studentUpdatedAt = student.updatedAt;
  if (!studentUpdatedAt) {
    // Can't safely cache without a stamped profile — return all null.
    for (const job of jobs) out.set(job._id.toString(), null);
    return out;
  }

  const jobIds = jobs.map((j) => j._id);
  const caches = await AIMatchCache.find({
    studentProfileId: student._id,
    jobId: { $in: jobIds },
  });
  const cacheMap = new Map<string, IAIMatchCache>(
    caches.map((c) => [c.jobId.toString(), c as IAIMatchCache]),
  );

  const toCompute: JobLike[] = [];
  for (const job of jobs) {
    const cache = cacheMap.get(job._id.toString());
    if (cache && isFresh(cache, studentUpdatedAt, job.updatedAt)) {
      out.set(job._id.toString(), toResult(cache));
    } else {
      toCompute.push(job);
    }
  }

  if (toCompute.length === 0) return out;

  // Skip the network entirely if the key is missing — fall back to nulls
  // and let the caller decide what to do.
  if (!process.env.ANTHROPIC_API_KEY) {
    for (const job of toCompute) out.set(job._id.toString(), null);
    return out;
  }

  const settled = await Promise.allSettled(
    toCompute.map(async (job) => {
      const result = await getAIMatchScore(student, job);
      if (job.updatedAt) {
        await persist(student._id, job._id, studentUpdatedAt, job.updatedAt, result);
      }
      return { jobId: job._id.toString(), result };
    }),
  );

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    const job = toCompute[i];
    if (s.status === "fulfilled") {
      out.set(s.value.jobId, { ...s.value.result, cached: false });
    } else {
      console.warn("[aiMatchScoreCached] failed for job", job._id.toString(), s.reason);
      out.set(job._id.toString(), null);
    }
  }

  return out;
}
