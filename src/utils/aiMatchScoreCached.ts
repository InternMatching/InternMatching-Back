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

// In-process dedupe so concurrent requests for the same (student, job) don't
// fire Claude in parallel. Lives only in this Node process; on restart it
// resets, which at worst means one duplicate call — fine.
const inFlight = new Set<string>();

function flightKey(studentId: any, jobId: any): string {
  return `${studentId.toString()}::${jobId.toString()}`;
}

function scheduleBackgroundCompute(
  student: StudentLike,
  job: JobLike,
): void {
  const studentUpdatedAt = student.updatedAt;
  const jobUpdatedAt = job.updatedAt;
  if (!studentUpdatedAt || !jobUpdatedAt) return;
  if (!process.env.ANTHROPIC_API_KEY) return;
  const key = flightKey(student._id, job._id);
  if (inFlight.has(key)) return;
  inFlight.add(key);
  // Fire and forget — the resolver has already returned the stale value to
  // the client. We update the cache so the next read sees the fresh score.
  (async () => {
    try {
      const fresh = await getAIMatchScore(student, job);
      await persist(student._id, job._id, studentUpdatedAt, jobUpdatedAt, fresh);
    } catch (err) {
      console.warn(
        "[aiMatchScoreCached] background compute failed for",
        key,
        err,
      );
    } finally {
      inFlight.delete(key);
    }
  })();
}

export type CacheReadMode = "wait" | "swr";

// Single student + single job. Default `wait` mode blocks on Claude when the
// cache is missing/stale (used by the on-demand AI panel, where the user
// explicitly asked for a fresh result). `swr` mode returns whatever's in the
// cache instantly (even if stale) and recomputes in the background, so list
// endpoints stay fast.
export async function getOrComputeAIMatch(
  student: StudentLike,
  job: JobLike,
  mode: CacheReadMode = "wait",
): Promise<CachedAIMatch | null> {
  const studentUpdatedAt = student.updatedAt;
  const jobUpdatedAt = job.updatedAt;

  const existing = await AIMatchCache.findOne({
    studentProfileId: student._id,
    jobId: job._id,
  });

  if (existing && isFresh(existing, studentUpdatedAt, jobUpdatedAt)) {
    return toResult(existing);
  }

  if (mode === "swr") {
    // Refresh in the background and return whatever we have right now.
    scheduleBackgroundCompute(student, job);
    return existing ? toResult(existing) : null;
  }

  // `wait` mode — block on Claude.
  const fresh = await getAIMatchScore(student, job);
  if (studentUpdatedAt && jobUpdatedAt) {
    await persist(student._id, job._id, studentUpdatedAt, jobUpdatedAt, fresh);
  }
  return { ...fresh, cached: false };
}

// Bulk variant: scores N jobs for one student. In `swr` mode (default for list
// endpoints) reads the cache in one query, returns whatever's there even if
// stale, and schedules background recompute. In `wait` mode blocks on Claude
// for missing/stale entries.
export async function getOrComputeAIMatchBatch(
  student: StudentLike,
  jobs: JobLike[],
  mode: CacheReadMode = "swr",
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

  const staleOrMissing: JobLike[] = [];
  for (const job of jobs) {
    const cache = cacheMap.get(job._id.toString());
    if (cache && isFresh(cache, studentUpdatedAt, job.updatedAt)) {
      out.set(job._id.toString(), toResult(cache));
    } else {
      // Return the stale value (if any) so the UI has something to show.
      out.set(job._id.toString(), cache ? toResult(cache) : null);
      staleOrMissing.push(job);
    }
  }

  if (staleOrMissing.length === 0) return out;

  if (mode === "swr") {
    // Background-refresh stale/missing entries; do not block the caller.
    for (const job of staleOrMissing) {
      scheduleBackgroundCompute(student, job);
    }
    return out;
  }

  // `wait` mode — block on Claude for the stale/missing entries.
  if (!process.env.ANTHROPIC_API_KEY) {
    for (const job of staleOrMissing) {
      if (!out.has(job._id.toString())) out.set(job._id.toString(), null);
    }
    return out;
  }

  const settled = await Promise.allSettled(
    staleOrMissing.map(async (job) => {
      const result = await getAIMatchScore(student, job);
      if (job.updatedAt) {
        await persist(student._id, job._id, studentUpdatedAt, job.updatedAt, result);
      }
      return { jobId: job._id.toString(), result };
    }),
  );

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    const job = staleOrMissing[i];
    if (s.status === "fulfilled") {
      out.set(s.value.jobId, { ...s.value.result, cached: false });
    } else {
      console.warn("[aiMatchScoreCached] failed for job", job._id.toString(), s.reason);
      // Leave whatever stale value is already in `out`.
    }
  }

  return out;
}
