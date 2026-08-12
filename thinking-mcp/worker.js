import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

const MODEL = "@cf/moonshotai/kimi-k2.7-code";
const MAX_INPUT_CHARS = 120_000;

function clamp(text, max = MAX_INPUT_CHARS) {
  return String(text ?? "").slice(0, max);
}

function extractText(result) {
  if (typeof result === "string") return result;
  if (result && typeof result.response === "string") return result.response;
  if (result && typeof result.output_text === "string") return result.output_text;
  return JSON.stringify(result);
}

function textResult(text, meta = {}) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ ...meta, result: text }, null, 2),
      },
    ],
  };
}

async function runThinking(env, messages, options = {}) {
  if (!env.AI) {
    throw new Error("Workers AI binding is not configured.");
  }

  const result = await env.AI.run(MODEL, {
    messages,
    max_tokens: Math.min(Math.max(options.maxTokens ?? 4096, 256), 8192),
    temperature: options.temperature ?? 0.2,
    chat_template_kwargs: {
      thinking: true,
    },
  });

  return {
    answer: extractText(result),
    model: MODEL,
  };
}

function createServer(env) {
  const server = new McpServer({
    name: "thinking-mcp",
    version: "1.1.0",
  });

  server.registerTool(
    "deep_think",
    {
      description:
        "Use this tool when a problem needs serious reasoning. It delegates the problem to a reasoning model with thinking enabled, then returns a concise reasoning summary, assumptions, checks, and a conclusion. It does not expose private chain-of-thought.",
      inputSchema: {
        problem: z.string().min(1).describe("The problem or question to reason about."),
        context: z.string().optional().describe("Relevant context, data, code, or constraints."),
        goal: z.string().optional().describe("What a successful result should accomplish."),
        depth: z
          .enum(["low", "medium", "high"])
          .default("high")
          .describe("Reasoning effort requested from the reasoning model."),
      },
    },
    async ({ problem, context, goal, depth }) => {
      const depthInstructions = {
        low: "Be efficient. Do a short but careful reasoning pass.",
        medium: "Use a substantial reasoning pass and check the main alternatives.",
        high: "Use a deep reasoning pass. Decompose the problem, test assumptions, consider alternatives, and perform a final self-check.",
      };

      const prompt = `You are the reasoning engine behind another AI assistant.

Solve the user's problem carefully.

IMPORTANT:
- Think deeply internally before answering.
- Do NOT reveal private chain-of-thought or hidden reasoning tokens.
- Instead provide a concise, useful reasoning SUMMARY.
- Distinguish facts from assumptions.
- If information is missing, say exactly what is missing.
- Check your conclusion before returning it.
- Prefer correctness over speed.

Return exactly these sections:
1. Reasoning summary
2. Key assumptions
3. Alternatives considered
4. Verification / self-check
5. Conclusion

${depthInstructions[depth]}

PROBLEM:
${clamp(problem)}

CONTEXT:
${clamp(context || "(none)")}

GOAL:
${clamp(goal || "(not specified)")}
`;

      const result = await runThinking(env, [
        {
          role: "system",
          content: "You are a rigorous reasoning specialist. Return reasoning summaries, not private chain-of-thought.",
        },
        { role: "user", content: prompt },
      ]);

      return textResult(result.answer, {
        tool: "deep_think",
        model: result.model,
        depth,
      });
    }
  );

  server.registerTool(
    "critique",
    {
      description:
        "Critically review an existing answer, plan, argument, or code. Find errors, weak assumptions, missing cases, and concrete improvements.",
      inputSchema: {
        subject: z.string().min(1).describe("The answer, plan, argument, or code to critique."),
        criteria: z.string().optional().describe("Specific criteria or requirements to check."),
      },
    },
    async ({ subject, criteria }) => {
      const prompt = `Critically review the material below.

Do not rewrite it yet. Identify:
- factual or logical errors
- unsupported assumptions
- missing edge cases
- contradictions
- risks
- what is already correct
- the highest-value fixes

Do not reveal private chain-of-thought. Give a concise critique and explain the evidence or reasoning behind each important finding.

MATERIAL:
${clamp(subject)}

CRITERIA:
${clamp(criteria || "(none)")}`;

      const result = await runThinking(env, [
        {
          role: "system",
          content: "You are a rigorous reviewer. Be skeptical but fair.",
        },
        { role: "user", content: prompt },
      ]);

      return textResult(result.answer, {
        tool: "critique",
        model: result.model,
      });
    }
  );

  server.registerTool(
    "plan",
    {
      description:
        "Turn a complex goal into a minimal, ordered execution plan with dependencies, decision points, and validation steps.",
      inputSchema: {
        goal: z.string().min(1).describe("The goal to accomplish."),
        constraints: z.string().optional().describe("Constraints, limitations, or requirements."),
      },
    },
    async ({ goal, constraints }) => {
      const prompt = `Create a rigorous execution plan for the goal below.

The plan should:
- clarify the objective
- break the work into the smallest useful steps
- identify dependencies
- identify decision points
- include validation/testing
- avoid unnecessary work
- state important assumptions

Do not reveal private chain-of-thought. Return the resulting plan and concise rationale for the key decisions.

GOAL:
${clamp(goal)}

CONSTRAINTS:
${clamp(constraints || "(none)")}`;

      const result = await runThinking(env, [
        {
          role: "system",
          content: "You are a senior planning and problem-solving specialist.",
        },
        { role: "user", content: prompt },
      ]);

      return textResult(result.answer, {
        tool: "plan",
        model: result.model,
      });
    }
  );

  server.registerTool(
    "verify",
    {
      description:
        "Perform a final verification pass on a proposed answer. Check correctness, consistency, assumptions, edge cases, and whether the requested goal was actually met.",
      inputSchema: {
        claim: z.string().min(1).describe("The proposed answer or claim to verify."),
        original_problem: z.string().optional().describe("The original problem or user request."),
      },
    },
    async ({ claim, original_problem }) => {
      const prompt = `Perform a final verification pass.

Check:
1. Does the answer actually address the original problem?
2. Are there factual or logical errors?
3. Are important assumptions clearly identified?
4. Are there edge cases or counterexamples?
5. Is the conclusion stronger than the evidence supports?
6. What should be corrected before delivery?

Return:
- Verdict: PASS / PASS WITH FIXES / FAIL
- Findings
- Required corrections
- Final confidence

Do not reveal private chain-of-thought.

ORIGINAL PROBLEM:
${clamp(original_problem || "(not supplied)")}

PROPOSED ANSWER:
${clamp(claim)}`;

      const result = await runThinking(env, [
        {
          role: "system",
          content: "You are a strict final-answer verifier.",
        },
        { role: "user", content: prompt },
      ]);

      return textResult(result.answer, {
        tool: "verify",
        model: result.model,
      });
    }
  );

  return server;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json({
        name: "Thinking MCP",
        version: "1.1.0",
        status: "ok",
        description: "Reasoning tools for MCP clients and ChatGPT custom MCP apps.",
        mcp_endpoint: "/mcp",
        authentication: "none",
        model: MODEL,
        tools: ["deep_think", "critique", "plan", "verify"],
      });
    }

    if (url.pathname !== "/mcp") {
      return new Response("Not Found", { status: 404 });
    }

    return createMcpHandler(
      () => createServer(env),
      {
        route: "/mcp",
        legacy: "stateless",
        responseMode: "auto",
      }
    )(request, env, ctx);
  },
};
