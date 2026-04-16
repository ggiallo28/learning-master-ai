import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { Message } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
  },
});

export async function bedrockGenerate(
  prompt: string,
  systemPrompt?: string,
  jsonMode?: boolean
): Promise<string> {
  const system = jsonMode
    ? `${systemPrompt || ""}\n\nIMPORTANT: Return a valid JSON object. No markdown formatting, no code blocks.`
    : systemPrompt;

  const response = await client.send(
    new ConverseCommand({
      modelId: process.env.AWS_BEDROCK_TEXT_MODEL || "us.anthropic.claude-sonnet-4-6",
      system: system ? [{ text: system }] : undefined,
      messages: [
        {
          role: "user",
          content: [{ text: prompt }],
        },
      ],
    })
  );

  const content = response.output?.message?.content?.[0];
  if (content && "text" in content) {
    let text = content.text || "";
    // Strip markdown code blocks if present (e.g., ```json ... ```)
    if (jsonMode && text.includes("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    return text;
  }
  return "";
}

export async function bedrockEmbed(text: string): Promise<number[]> {
  const response = await client.send(
    new InvokeModelCommand({
      modelId: process.env.AWS_BEDROCK_EMBED_MODEL || "amazon.titan-embed-text-v2:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        inputText: text,
      }),
    })
  );

  const result = JSON.parse(Buffer.from(response.body || new Uint8Array()).toString());
  return result.embedding || [];
}

// Helper to calculate cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

// Helper to search notes by embedding similarity
async function searchNotesByEmbedding(
  query: string,
  notes: Array<{ id: string; title: string; content: string; embedding?: number[] }>,
  limit: number = 5
): Promise<Array<{ id: string; title: string; content: string }>> {
  if (notes.length === 0) {
    return [];
  }

  const queryEmbedding = await bedrockEmbed(query);
  if (queryEmbedding.length === 0) {
    return [];
  }

  const scored = notes
    .filter((n) => n.embedding && n.embedding.length > 0)
    .map((n) => ({
      note: n,
      score: cosineSimilarity(queryEmbedding, n.embedding || []),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => ({ id: s.note.id, title: s.note.title, content: s.note.content }));
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export async function bedrockChat(
  messages: Message[],
  systemPrompt: string,
  notes: Array<{ id: string; title: string; content: string; embedding?: number[] }> = [],
  tools?: ToolDefinition[],
  onToken?: (token: string) => void
): Promise<{ text: string; toolCalls: Array<{ name: string; args: unknown }> }> {
  let bedrockMessages: Message[] = [...messages];
  let fullText = "";
  const toolCalls: Array<{ name: string; args: unknown }> = [];
  let continueLoop = true;
  let loopCount = 0;
  const maxLoops = 10;

  while (continueLoop && loopCount < maxLoops) {
    loopCount++;
    continueLoop = false;

    const response = await client.send(
      new ConverseCommand({
        modelId: process.env.AWS_BEDROCK_TEXT_MODEL || "us.anthropic.claude-sonnet-4-6",
        system: systemPrompt ? [{ text: systemPrompt }] : undefined,
        messages: bedrockMessages,
        toolConfig: tools && tools.length > 0
          ? {
              tools: tools.map((tool) => ({
                toolSpec: {
                  name: tool.name,
                  description: tool.description,
                  inputSchema: {
                    json: tool.inputSchema,
                  },
                },
              })),
            }
          : undefined,
      })
    );

    const messageContent = response.output?.message?.content || [];

    // Accumulate text tokens
    for (const content of messageContent) {
      if ("text" in content && content.text) {
        fullText += content.text;
        if (onToken) onToken(content.text);
      }
    }

    // Add assistant message to conversation history
    bedrockMessages.push({
      role: "assistant",
      content: messageContent,
    });

    // Check for tool calls
    for (const content of messageContent) {
      if ("toolUseId" in content && "name" in content && "input" in content) {
        const toolName = content.name as string;
        const toolInput = content.input as Record<string, unknown>;
        const toolUseId = content.toolUseId as string;

        // Handle search_notes specially (can be resolved server-side)
        if (toolName === "search_notes" && "query" in toolInput) {
          const query = toolInput.query as string;
          const results = await searchNotesByEmbedding(query, notes, 5);
          const resultText = results
            .map((n) => `[ID: ${n.id}] Title: ${n.title}\nContent: ${n.content}`)
            .join("\n---\n");

          // Add tool result to messages
          bedrockMessages.push({
            role: "user",
            content: [
              {
                toolResult: {
                  toolUseId,
                  content: [
                    {
                      text: resultText || "No notes found.",
                    },
                  ],
                },
              },
            ],
          });

          continueLoop = true;
        } else {
          // UI tools (add_note, navigate_to, etc.) - return to caller for client-side handling
          toolCalls.push({ name: toolName, args: toolInput });
        }
      }
    }
  }

  return { text: fullText, toolCalls };
}

export async function bedrockChatStream(
  messages: Message[],
  systemPrompt: string,
  notes: Array<{ id: string; title: string; content: string; embedding?: number[] }> = [],
  tools?: ToolDefinition[],
  onToken?: (token: string) => void
): Promise<{ text: string; toolCalls: Array<{ name: string; args: unknown }> }> {
  let fullText = "";
  const toolCalls: Array<{ name: string; args: unknown }> = [];

  const response = await client.send(
    new ConverseStreamCommand({
      modelId: process.env.AWS_BEDROCK_TEXT_MODEL || "us.anthropic.claude-sonnet-4-6",
      system: systemPrompt ? [{ text: systemPrompt }] : undefined,
      messages: messages,
      toolConfig: tools && tools.length > 0
        ? {
            tools: tools.map((tool) => ({
              toolSpec: {
                name: tool.name,
                description: tool.description,
                inputSchema: {
                  json: tool.inputSchema,
                },
              },
            })),
          }
        : undefined,
    })
  );

  for await (const event of response.stream) {
    // Handle text content
    if (event.contentBlockDelta?.delta?.text) {
      const text = event.contentBlockDelta.delta.text;
      fullText += text;
      if (onToken) onToken(text);
    }

    // Handle tool use start
    if (event.contentBlockStart?.contentBlock?.toolUseBlock) {
      const toolBlock = event.contentBlockStart.contentBlock.toolUseBlock;
      // Initialize tool call tracking if needed
    }

    // Handle tool use delta (input accumulation)
    if (event.contentBlockDelta?.delta?.toolUseDelta) {
      // Tool input is being streamed, we'll collect it when we have the full input
    }
  }

  return { text: fullText, toolCalls };
}
