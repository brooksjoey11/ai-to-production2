import { invokeLLM } from "./_core/llm";
import { getPrompt, getModel } from "./configService";
import logger from "./logger";

export interface PipelineInput {
  code: string;
  language: string;
  userComments?: string;
}

export interface PipelineOutput {
  forensicDossier: string;
  rebuiltCode: string;
  qualityReport: string;
  tokensUsed: number;
}

/**
 * Three-step LLM pipeline:
 * 1. Forensic Analysis – detect bugs, vulnerabilities, issues
 * 2. Code Rebuilder – fix all issues, output only code
 * 3. Quality Checker – summarize improvements in plain language
 *
 * Each step reads its system prompt from the config service (DB-backed, admin-editable).
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  let totalTokens = 0;

  // ─── Step 1: Forensic Analysis ───
  const forensicPrompt = await getPrompt("forensic");
  const forensicModel = await getModel("forensic");
  const forensicUserMsg = buildForensicUserMessage(input);
  logger.info({ step: "forensic", model: forensicModel }, "Pipeline step starting");

  const forensicResult = await invokeLLM({
    model: forensicModel,
    messages: [
      { role: "system", content: forensicPrompt },
      { role: "user", content: forensicUserMsg },
    ],
  });

  const forensicDossier = extractContent(forensicResult);
  totalTokens += forensicResult.usage?.total_tokens ?? 0;

  // ─── Step 2: Code Rebuilder ───
  const rebuilderPrompt = await getPrompt("rebuilder");
  const rebuilderModel = await getModel("rebuilder");
  const rebuilderUserMsg = buildRebuilderUserMessage(input, forensicDossier);
  logger.info({ step: "rebuilder", model: rebuilderModel }, "Pipeline step starting");

  const rebuilderResult = await invokeLLM({
    model: rebuilderModel,
    messages: [
      { role: "system", content: rebuilderPrompt },
      { role: "user", content: rebuilderUserMsg },
    ],
  });

  const rebuiltCode = extractCodeFromResponse(extractContent(rebuilderResult));
  totalTokens += rebuilderResult.usage?.total_tokens ?? 0;

  // ─── Step 3: Quality Report ───
  const qualityPrompt = await getPrompt("quality");
  const qualityModel = await getModel("quality");
  const qualityUserMsg = buildQualityUserMessage(input, forensicDossier, rebuiltCode);
  logger.info({ step: "quality", model: qualityModel }, "Pipeline step starting");

  const qualityResult = await invokeLLM({
    model: qualityModel,
    messages: [
      { role: "system", content: qualityPrompt },
      { role: "user", content: qualityUserMsg },
    ],
  });

  const qualityReport = extractContent(qualityResult);
  totalTokens += qualityResult.usage?.total_tokens ?? 0;

  return {
    forensicDossier,
    rebuiltCode,
    qualityReport,
    tokensUsed: totalTokens,
  };
}

// ─── Message builders ───

function buildForensicUserMessage(input: PipelineInput): string {
  let msg = `Analyze the following ${input.language} code:\n\n\`\`\`${input.language}\n${input.code}\n\`\`\``;
  if (input.userComments) {
    msg += `\n\nDeveloper notes: ${input.userComments}`;
  }
  return msg;
}

function buildRebuilderUserMessage(input: PipelineInput, forensicDossier: string): string {
  return `Here is the original ${input.language} code:\n\n\`\`\`${input.language}\n${input.code}\n\`\`\`\n\nHere is the forensic analysis:\n\n${forensicDossier}\n\nRewrite the code to fix all identified issues. Output only the corrected code.`;
}

function buildQualityUserMessage(input: PipelineInput, forensicDossier: string, rebuiltCode: string): string {
  return `Original ${input.language} code:\n\n\`\`\`${input.language}\n${input.code}\n\`\`\`\n\nForensic analysis:\n\n${forensicDossier}\n\nRebuilt code:\n\n\`\`\`${input.language}\n${rebuiltCode}\n\`\`\`\n\nSummarize the improvements in plain language.`;
}

// ─── Helpers ───

function extractContent(result: Awaited<ReturnType<typeof invokeLLM>>): string {
  const msg = result.choices?.[0]?.message;
  if (!msg) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n");
  }
  return "";
}

function extractCodeFromResponse(text: string): string {
  // Try to extract code from markdown code blocks
  const codeBlockMatch = text.match(/```[\w]*\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  // If no code block, return the full text (it should be pure code)
  return text.trim();
}
