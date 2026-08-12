import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

const VERSION = "2.0.0";

/*
 * Instruction-only Thinking MCP
 *
 * IMPORTANT ARCHITECTURE:
 * - This MCP does NOT call an AI model.
 * - This MCP does NOT use Workers AI.
 * - This MCP does NOT generate the requested answer itself.
 * - Each tool returns detailed operating instructions plus the user's input.
 * - The MCP client (for example ChatGPT) is expected to follow those
 *   instructions and produce the final answer itself.
 */

function instructionResult(tool, instructions, input) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            tool,
            mode: "instruction_only",
            instructions,
            user_input: input,
            execution_note:
              "Follow these instructions yourself. Do not delegate the task to another model merely because this MCP returned instructions. Produce the final response for the user using the supplied input and the instructions above.",
          },
          null,
          2
        ),
      },
    ],
  };
}

const DEEP_THINK_INSTRUCTIONS = `
You are operating in DEEP THINK mode.

Purpose:
Solve the user's problem with unusually careful reasoning while keeping the final response useful, direct, and appropriate to the request.

Follow this procedure:
1. Identify exactly what the user is asking for. Do not solve a different or broader problem.
2. Extract the objective, constraints, relevant facts, unknowns, and success criteria.
3. Break the problem into the smallest useful reasoning units.
4. Distinguish facts supplied by the user from assumptions and inferences.
5. Consider the strongest plausible alternatives, approaches, or interpretations when they could change the answer.
6. Check dependencies and causal relationships rather than jumping to the first plausible conclusion.
7. Look for contradictions, edge cases, hidden constraints, and failure modes.
8. If current or external information is required, use available tools/web search when appropriate instead of inventing facts.
9. Perform a final self-check: verify that the proposed answer actually satisfies the original request and that confidence is proportional to the evidence.
10. Give the user the result, not private chain-of-thought. Provide a concise reasoning summary only when it helps explain the conclusion.

Output principles:
- Correctness over speed.
- Be explicit about uncertainty.
- Never fabricate missing information.
- Do not expose private chain-of-thought or hidden reasoning tokens.
- Prefer concrete conclusions, calculations, steps, or recommendations over vague discussion.
- If multiple answers are possible, explain the meaningful difference and choose the best one when possible.
- Match the user's language and requested level of detail.
`;

const CRITIC_INSTRUCTIONS = `
You are operating in CRITIC mode.

Purpose:
Rigorously inspect the user's supplied answer, plan, argument, code, claim, or other material and identify what is correct, what is wrong, what is missing, and what should be improved.

Follow this procedure:
1. Determine what the material is intended to accomplish.
2. Establish the relevant requirements and evaluation criteria from the user's request.
3. Check factual accuracy, logical validity, internal consistency, completeness, and relevance.
4. Identify unsupported assumptions and distinguish them from verified facts.
5. Test important claims against counterexamples, edge cases, or alternative interpretations.
6. Check whether the proposed solution actually satisfies the original goal.
7. Separate critical errors from minor stylistic or optional improvements.
8. Identify risks and likely failure points.
9. State what is already correct so the critique is balanced and actionable.
10. Prioritize the highest-value fixes and explain why they matter.
11. If external/current facts are necessary, verify them with available tools/web search rather than guessing.

Output format:
- Verdict: clearly state whether the material is sound, sound with fixes, or unsound.
- What is correct: the strongest valid parts.
- Problems found: factual, logical, structural, technical, or requirement-related issues.
- Missing cases: important omissions or edge cases.
- Required fixes: concrete corrections in priority order.
- Optional improvements: useful but non-essential changes.

Do not silently rewrite the material unless the user asks for a rewrite. Do not expose private chain-of-thought. Give concise evidence or reasoning summaries for important findings.
`;

const PLAN_INSTRUCTIONS = `
You are operating in PLAN mode.

Purpose:
Turn the user's goal into a practical, ordered execution plan that can actually be followed.

Follow this procedure:
1. Define the desired end state in one precise sentence.
2. Extract constraints, resources, deadlines, dependencies, and assumptions.
3. Break the work into the smallest useful sequence of actions.
4. Put steps in dependency order; do not place an action before the information or prerequisite it needs.
5. Identify decision points where the next step depends on a result or choice.
6. Prefer the simplest path that reliably reaches the goal.
7. Include validation/testing after important actions.
8. Identify likely failure points and what to do if they occur.
9. Avoid unnecessary steps, speculative work, and invented requirements.
10. Clearly mark assumptions and information that must be confirmed.
11. If the plan depends on current information such as schedules, prices, availability, software versions, policies, or locations, use available tools/web search to verify it.
12. End with a clear completion criterion so it is obvious when the goal has been achieved.

Output format:
1. Objective
2. Assumptions / constraints
3. Ordered steps
4. Decision points
5. Validation / testing
6. Risks and fallback options
7. Completion criteria

Do not expose private chain-of-thought. Give concise rationale for important decisions only.
`;

const VERIFY_INSTRUCTIONS = `
You are operating in VERIFY mode.

Purpose:
Perform a strict final verification of a proposed answer, claim, plan, calculation, or solution before it is delivered to the user.

Follow this procedure:
1. Identify the original user request and its success criteria.
2. Compare the proposed answer against the original request line by line conceptually.
3. Check factual claims, calculations, logical steps, consistency, and terminology.
4. Check whether assumptions are stated and justified.
5. Look for missing requirements, edge cases, counterexamples, and unintended consequences.
6. Check whether the conclusion is stronger than the available evidence supports.
7. Verify current/external facts with available tools/web search when needed.
8. Determine whether corrections are required before delivery.
9. If corrections are required, state exactly what must change; do not merely say that something is wrong.
10. Perform one final pass after identifying corrections to ensure the corrected conclusion would satisfy the original request.

Output format:
- Verdict: PASS / PASS WITH FIXES / FAIL
- Requirement check
- Findings
- Required corrections
- Remaining risks or uncertainty
- Final confidence

Do not expose private chain-of-thought. Give concise evidence or reasoning summaries for important findings.
`;

function createServer() {
  const server = new McpServer({
    name: "thinking-mcp",
    version: VERSION,
  });

  server.registerTool(
    "deep_think",
    {
      description:
        "Instruction-only deep reasoning mode. Returns detailed instructions for ChatGPT to solve the supplied problem itself; this MCP does not call an AI model.",
      inputSchema: {
        problem: z.string().min(1).describe("The user's problem or question."),
        context: z.string().optional().describe("Relevant context, data, code, or constraints."),
        goal: z.string().optional().describe("What a successful result should accomplish."),
      },
    },
    async ({ problem, context, goal }) =>
      instructionResult("deep_think", DEEP_THINK_INSTRUCTIONS, {
        problem,
        context: context || null,
        goal: goal || null,
      })
  );

  server.registerTool(
    "critic",
    {
      description:
        "Instruction-only critical review mode. Returns detailed instructions for ChatGPT to critique the supplied material itself; this MCP does not call an AI model.",
      inputSchema: {
        subject: z.string().min(1).describe("The answer, plan, argument, claim, or code to critique."),
        criteria: z.string().optional().describe("Specific requirements or evaluation criteria."),
        original_problem: z.string().optional().describe("The original user request, when available."),
      },
    },
    async ({ subject, criteria, original_problem }) =>
      instructionResult("critic", CRITIC_INSTRUCTIONS, {
        subject,
        criteria: criteria || null,
        original_problem: original_problem || null,
      })
  );

  server.registerTool(
    "plan",
    {
      description:
        "Instruction-only planning mode. Returns detailed instructions for ChatGPT to create the plan itself; this MCP does not call an AI model.",
      inputSchema: {
        goal: z.string().min(1).describe("The goal to accomplish."),
        constraints: z.string().optional().describe("Constraints, limitations, resources, deadlines, or requirements."),
      },
    },
    async ({ goal, constraints }) =>
      instructionResult("plan", PLAN_INSTRUCTIONS, {
        goal,
        constraints: constraints || null,
      })
  );

  server.registerTool(
    "verify",
    {
      description:
        "Instruction-only verification mode. Returns detailed instructions for ChatGPT to verify the supplied answer itself; this MCP does not call an AI model.",
      inputSchema: {
        claim: z.string().min(1).describe("The proposed answer, claim, plan, calculation, or solution to verify."),
        original_problem: z.string().optional().describe("The original user request or problem."),
      },
    },
    async ({ claim, original_problem }) =>
      instructionResult("verify", VERIFY_INSTRUCTIONS, {
        claim,
        original_problem: original_problem || null,
      })
  );

  return server;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json({
        name: "Thinking MCP",
        version: VERSION,
        status: "ok",
        description:
          "Instruction-only reasoning tools for MCP clients and ChatGPT custom MCP apps.",
        mcp_endpoint: "/mcp",
        authentication: "none",
        execution: "client-side",
        model: null,
        tools: ["deep_think", "critic", "plan", "verify"],
      });
    }

    if (url.pathname !== "/mcp") {
      return new Response("Not Found", { status: 404 });
    }

    return createMcpHandler(
      () => createServer(),
      {
        route: "/mcp",
        legacy: "stateless",
        responseMode: "auto",
      }
    )(request, env, ctx);
  },
};
