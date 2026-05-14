import Anthropic from "@anthropic-ai/sdk";
import { ExperienceLevel } from "../types/index.js";

export interface CVParseResult {
  firstName?: string;
  lastName?: string;
  bio?: string;
  skills: string[];
  education: {
    school: string;
    degree: string;
    year: number;
    status?: string;
  }[];
  experienceLevel: ExperienceLevel;
}

const MODEL = "claude-sonnet-4-6";

export async function parseCV(base64PDF: string): Promise<CVParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const client = new Anthropic({ apiKey });

  const pdfData = base64PDF.replace(/^data:[^;]+;base64,/, "");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [
      {
        name: "extract_cv_data",
        description: "Extract structured information from a CV/resume document. Detect the primary language of the CV and preserve it in all text fields (bio, degree, school). If the CV is in Mongolian, write bio and degree/school in Mongolian. If in English, write in English. Skills are always canonical tech names (e.g. React, TypeScript) regardless of language.",
        input_schema: {
          type: "object" as const,
          properties: {
            firstName: {
              type: "string",
              description: "Candidate's first name",
            },
            lastName: {
              type: "string",
              description: "Candidate's last name/family name",
            },
            bio: {
              type: "string",
              description:
                "2-3 sentence professional summary written in first person, based on their CV experience and skills. Write in the same language as the CV — Mongolian if the CV is in Mongolian, English if in English.",
            },
            skills: {
              type: "array",
              items: { type: "string" },
              description:
                "Technical skills, programming languages, frameworks, tools — canonical display names (e.g. React, TypeScript, Figma). Max 15 items.",
            },
            education: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  school: {
                    type: "string",
                    description: "University or school name",
                  },
                  degree: {
                    type: "string",
                    description: "Degree title and field of study. Preserve the language of the CV.",
                  },
                  year: {
                    type: "number",
                    description:
                      "Graduation year or expected graduation year as integer",
                  },
                  status: {
                    type: "string",
                    enum: ["studying", "graduated"],
                    description:
                      "studying = currently enrolled, graduated = completed",
                  },
                },
                required: ["school", "degree", "year"],
              },
              description: "Education history, most recent first",
            },
          },
          required: ["skills", "education"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "extract_cv_data" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfData,
            },
          } as any,
          {
            type: "text",
            text: "Extract all relevant information from this CV/resume for an intern candidate profile on an internship matching platform. Focus on technical skills, education history, and synthesize a professional bio from the content. IMPORTANT: Detect the primary language of the CV. Write the bio, school names, and degree titles in that same language — if the CV is in Mongolian write those fields in Mongolian, if in English write in English. Do not translate. Skills must always use canonical English tech names (e.g. React, Python, Figma).",
          },
        ],
      },
    ],
  });

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock)
    throw new Error("CV parsing failed: no structured output returned");

  const parsed = toolBlock.input as Partial<CVParseResult>;

  return {
    firstName:
      typeof parsed.firstName === "string"
        ? parsed.firstName.trim()
        : undefined,
    lastName:
      typeof parsed.lastName === "string" ? parsed.lastName.trim() : undefined,
    bio: typeof parsed.bio === "string" ? parsed.bio.trim() : undefined,
    skills: Array.isArray(parsed.skills)
      ? parsed.skills
          .filter(
            (s): s is string => typeof s === "string" && s.trim().length > 0,
          )
          .slice(0, 15)
      : [],
    education: Array.isArray(parsed.education)
      ? parsed.education.filter(
          (e) =>
            e &&
            typeof e.school === "string" &&
            typeof e.degree === "string" &&
            typeof e.year === "number",
        )
      : [],
    experienceLevel: ExperienceLevel.INTERN,
  };
}
