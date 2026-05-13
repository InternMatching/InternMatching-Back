import Anthropic from "@anthropic-ai/sdk";

export interface CVSectionFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
}

export interface CVReviewResult {
  overallScore: number;
  overallSummary: string;
  sections: {
    contact: CVSectionFeedback;
    summary: CVSectionFeedback;
    experience: CVSectionFeedback;
    education: CVSectionFeedback;
    skills: CVSectionFeedback;
    format: CVSectionFeedback;
  };
  topRecommendations: string[];
  atsScore: number;
  verdict: string;
}

// Flat shape Claude actually fills — avoids nested-object omission bugs
interface FlatCVReview {
  overallScore: number;
  overallSummary: string;
  contactScore: number;
  contactStrengths: string[];
  contactImprovements: string[];
  summaryScore: number;
  summaryStrengths: string[];
  summaryImprovements: string[];
  experienceScore: number;
  experienceStrengths: string[];
  experienceImprovements: string[];
  educationScore: number;
  educationStrengths: string[];
  educationImprovements: string[];
  skillsScore: number;
  skillsStrengths: string[];
  skillsImprovements: string[];
  formatScore: number;
  formatStrengths: string[];
  formatImprovements: string[];
  topRecommendations: string[];
  atsScore: number;
  verdict: string;
}

const MODEL = "claude-sonnet-4-6";

function clamp(n: unknown): number {
  const v = typeof n === "number" ? n : 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]).filter((s) => typeof s === "string") : [];
}

function section(score: unknown, strengths: unknown, improvements: unknown): CVSectionFeedback {
  return { score: clamp(score), strengths: arr(strengths), improvements: arr(improvements) };
}

export async function reviewCV(base64PDF: string): Promise<CVReviewResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const client = new Anthropic({ apiKey });
  const pdfData = base64PDF.replace(/^data:[^;]+;base64,/, "");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    tool_choice: { type: "tool", name: "review_cv" },
    tools: [
      {
        name: "review_cv",
        description: "CV-г мэргэжлийн шүүмжлэгчийн нүдээр шинжилж, бүтэцтэй үнэлгээ өгнө.",
        input_schema: {
          type: "object" as const,
          required: [
            "overallScore", "overallSummary",
            "contactScore", "contactStrengths", "contactImprovements",
            "summaryScore", "summaryStrengths", "summaryImprovements",
            "experienceScore", "experienceStrengths", "experienceImprovements",
            "educationScore", "educationStrengths", "educationImprovements",
            "skillsScore", "skillsStrengths", "skillsImprovements",
            "formatScore", "formatStrengths", "formatImprovements",
            "topRecommendations", "atsScore", "verdict",
          ],
          properties: {
            overallScore:         { type: "number",  description: "Нийт оноо 0-100" },
            overallSummary:       { type: "string",  description: "2-3 өгүүлбэр нийт дүгнэлт (монгол)" },
            contactScore:         { type: "number",  description: "Холбоо барих хэсгийн оноо 0-100" },
            contactStrengths:     { type: "array", items: { type: "string" }, description: "Давуу талууд (монгол)" },
            contactImprovements:  { type: "array", items: { type: "string" }, description: "Сайжруулах зүйлс (монгол)" },
            summaryScore:         { type: "number",  description: "Товч танилцуулгын оноо 0-100" },
            summaryStrengths:     { type: "array", items: { type: "string" }, description: "Давуу талууд (монгол)" },
            summaryImprovements:  { type: "array", items: { type: "string" }, description: "Сайжруулах зүйлс (монгол)" },
            experienceScore:      { type: "number",  description: "Ажлын туршлагын оноо 0-100" },
            experienceStrengths:  { type: "array", items: { type: "string" }, description: "Давуу талууд (монгол)" },
            experienceImprovements:{ type: "array", items: { type: "string" }, description: "Сайжруулах зүйлс (монгол)" },
            educationScore:       { type: "number",  description: "Боловсролын оноо 0-100" },
            educationStrengths:   { type: "array", items: { type: "string" }, description: "Давуу талууд (монгол)" },
            educationImprovements:{ type: "array", items: { type: "string" }, description: "Сайжруулах зүйлс (монгол)" },
            skillsScore:          { type: "number",  description: "Ур чадварын оноо 0-100" },
            skillsStrengths:      { type: "array", items: { type: "string" }, description: "Давуу талууд (монгол)" },
            skillsImprovements:   { type: "array", items: { type: "string" }, description: "Сайжруулах зүйлс (монгол)" },
            formatScore:          { type: "number",  description: "Дизайн/форматын оноо 0-100" },
            formatStrengths:      { type: "array", items: { type: "string" }, description: "Давуу талууд (монгол)" },
            formatImprovements:   { type: "array", items: { type: "string" }, description: "Сайжруулах зүйлс (монгол)" },
            topRecommendations:   { type: "array", items: { type: "string" }, description: "Хамгийн чухал 5 зөвлөмж (монгол)" },
            atsScore:             { type: "number",  description: "ATS нийцлийн оноо 0-100" },
            verdict:              { type: "string",  description: "Эцсийн дүгнэлт 2-3 өгүүлбэр (монгол)" },
          },
        },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfData },
          } as any,
          {
            type: "text",
            text: "Та мэргэжлийн CV шүүмжлэгч. Дадлагын ажил хайж буй оюутны энэ CV-г дараах хэсгүүдэд үнэлнэ үү: холбоо барих мэдээлэл, товч танилцуулга, ажлын туршлага, боловсрол, ур чадвар, дизайн/формат. Бүх хариулт МОНГОЛ ХЭЛЭЭР байна. Оноо тус бүрт тодорхой, хэрэгжүүлж болохуйц давуу тал болон сайжруулах зөвлөмж өгнө үү.",
          },
        ],
      },
    ],
  });

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolBlock) throw new Error("CV review failed: no structured output returned");

  const r = toolBlock.input as FlatCVReview;

  return {
    overallScore: clamp(r.overallScore),
    overallSummary: r.overallSummary ?? "",
    atsScore: clamp(r.atsScore),
    verdict: r.verdict ?? "",
    topRecommendations: arr(r.topRecommendations).slice(0, 5),
    sections: {
      contact:    section(r.contactScore,    r.contactStrengths,    r.contactImprovements),
      summary:    section(r.summaryScore,    r.summaryStrengths,    r.summaryImprovements),
      experience: section(r.experienceScore, r.experienceStrengths, r.experienceImprovements),
      education:  section(r.educationScore,  r.educationStrengths,  r.educationImprovements),
      skills:     section(r.skillsScore,     r.skillsStrengths,     r.skillsImprovements),
      format:     section(r.formatScore,     r.formatStrengths,     r.formatImprovements),
    },
  };
}
