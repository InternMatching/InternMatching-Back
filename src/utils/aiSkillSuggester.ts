import Anthropic from "@anthropic-ai/sdk";
import { normalizeSkill } from "./matchScore/skills.js";

type EducationEntry = {
  school?: string;
  degree?: string;
  year?: number;
  status?: string;
};

type ProfileForSuggestion = {
  bio?: string;
  experienceLevel?: string;
  education?: EducationEntry[];
};

const MODEL = "claude-haiku-4-5-20251001";
const MAX_RESULTS = 10;

const SYSTEM_PROMPT =
  "You suggest professional/technical skills for a student's intern profile. " +
  "Output skills that are concrete, resume-grade, and inferable from the student's bio, education, and existing skills. " +
  "Prefer canonical names (e.g. 'React', 'TypeScript', 'Figma') over phrases. " +
  "Avoid duplicates of skills the student already has. " +
  "Avoid generic soft skills like 'teamwork' unless the bio specifically demonstrates them.";

export async function suggestSkillsForStudent(
  profile: ProfileForSuggestion,
  existingSkills: string[],
): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "[AISkillSuggester] ANTHROPIC_API_KEY is not defined in environment variables!",
    );
    throw new Error("AI configuration missing: ANTHROPIC_API_KEY");
  }

  const client = new Anthropic({ apiKey });

  const educationText =
    (profile.education ?? [])
      .map(
        (e) =>
          `- ${e.degree ?? "?"} at ${e.school ?? "?"} (${e.year ?? "?"}, ${e.status ?? "?"})`,
      )
      .join("\n") || "(none provided)";

  const userMessage =
    `Bio: ${profile.bio?.trim() || "(empty)"}\n` +
    `Experience level: ${profile.experienceLevel || "intern"}\n` +
    `Education:\n${educationText}\n` +
    `Existing skills: ${existingSkills.length ? existingSkills.join(", ") : "(none)"}\n\n` +
    `Suggest 6-12 new skills this student likely has or should claim, that are NOT in their existing skills list. ` +
    `Call the return_skill_suggestions tool with your answer.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "return_skill_suggestions",
        description:
          "Return the list of suggested skills for the student profile.",
        input_schema: {
          type: "object",
          properties: {
            skills: {
              type: "array",
              items: { type: "string" },
              minItems: 6,
              maxItems: 12,
              description:
                "Suggested skills, in canonical display casing (e.g. 'React', 'TypeScript').",
            },
          },
          required: ["skills"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "return_skill_suggestions" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) {
    console.error("[AISkillSuggester] Model returned no tool_use block", {
      stopReason: response.stop_reason,
    });
    throw new Error("AI suggestion failed: no structured output");
  }

  const raw = (toolBlock.input as { skills?: unknown })?.skills;
  if (!Array.isArray(raw)) {
    throw new Error("AI suggestion failed: malformed output");
  }

  const existingNormalized = new Set(existingSkills.map(normalizeSkill));
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const norm = normalizeSkill(trimmed);
    if (!norm) continue;
    if (existingNormalized.has(norm)) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    result.push(trimmed);
    if (result.length >= MAX_RESULTS) break;
  }

  return result;
}
