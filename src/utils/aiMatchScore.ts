import Anthropic from "@anthropic-ai/sdk";

export interface AIMatchResult {
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendation: "hire" | "maybe" | "pass";
}

const MODEL = "claude-haiku-4-5-20251001";

export async function getAIMatchScore(
  student: {
    firstName?: string | null;
    lastName?: string | null;
    bio?: string | null;
    skills?: string[] | null;
    education?:
      | { school: string; degree: string; year: number; status?: string }[]
      | null;
    experienceLevel?: string | null;
  },
  job: {
    title: string;
    requiredSkills?: string[] | null;
    description?: string | null;
    requirements?: string | null;
    responsibilities?: string | null;
  },
): Promise<AIMatchResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const client = new Anthropic({ apiKey });

  const studentText = [
    student.firstName || student.lastName
      ? `Name: ${[student.firstName, student.lastName].filter(Boolean).join(" ")}`
      : null,
    `Bio: ${student.bio?.trim() || "Not provided"}`,
    `Skills: ${(student.skills || []).join(", ") || "None listed"}`,
    `Education: ${
      (student.education || [])
        .map(
          (e) =>
            `${e.degree} at ${e.school} (${e.year}${e.status ? ", " + e.status : ""})`,
        )
        .join("; ") || "Not provided"
    }`,
    `Experience level: ${student.experienceLevel || "intern"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const jobText = [
    `Title: ${job.title}`,
    `Required Skills: ${(job.requiredSkills || []).join(", ") || "Not specified"}`,
    job.description ? `Description: ${job.description}` : null,
    job.requirements ? `Requirements: ${job.requirements}` : null,
    job.responsibilities ? `Responsibilities: ${job.responsibilities}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    tools: [
      {
        name: "evaluate_match",
        description:
          "Evaluate how well an intern candidate matches a job posting",
        input_schema: {
          type: "object" as const,
          properties: {
            score: {
              type: "number",
              description: "Overall match score from 0 to 100",
            },
            summary: {
              type: "string",
              description: "One concise sentence summarizing the overall fit",
            },
            strengths: {
              type: "array",
              items: { type: "string" },
              description:
                "Up to 3 specific reasons this candidate is a good fit",
            },
            gaps: {
              type: "array",
              items: { type: "string" },
              description:
                "Up to 3 specific areas where the candidate falls short",
            },
            recommendation: {
              type: "string",
              enum: ["hire", "maybe", "pass"],
              description:
                "hire = strong fit, invite for interview; maybe = potential but needs review; pass = poor fit",
            },
          },
          required: ["score", "summary", "strengths", "gaps", "recommendation"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "evaluate_match" },
    messages: [
      {
        role: "user",
        content: `You are an experienced HR manager evaluating an intern candidate for a specific position.

CANDIDATE PROFILE:
${studentText}

INTERNSHIP POSITION:
${jobText}

Evaluate objectively based on skill alignment, relevant experience, and potential to succeed. Be specific — reference actual skills and requirements from both sides.`,
      },
    ],
  });

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock)
    throw new Error("AI match scoring failed: no structured output");

  const result = toolBlock.input as AIMatchResult;

  return {
    score: Math.max(0, Math.min(100, Math.round(Number(result.score) || 0))),
    summary: typeof result.summary === "string" ? result.summary : "",
    strengths: Array.isArray(result.strengths)
      ? result.strengths
          .filter((s): s is string => typeof s === "string")
          .slice(0, 3)
      : [],
    gaps: Array.isArray(result.gaps)
      ? result.gaps
          .filter((g): g is string => typeof g === "string")
          .slice(0, 3)
      : [],
    recommendation: ["hire", "maybe", "pass"].includes(result.recommendation)
      ? result.recommendation
      : "maybe",
  };
}
