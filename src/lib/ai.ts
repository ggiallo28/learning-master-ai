// Unified AI provider interface - routes to Gemini or Bedrock based on AI_PROVIDER env var

import * as geminiModule from "./gemini";
import * as agentModule from "./noteAgent";

const provider = process.env.AI_PROVIDER || "gemini";

// ============= Bedrock Client Proxies (for use when AI_PROVIDER=bedrock) =============

async function bedrockFetch(endpoint: string, body: any) {
  const response = await fetch(`/api/ai${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Bedrock API error: ${response.statusText}`);
  }

  return response.json();
}

// ============= Unified Function Implementations =============

export async function generateEmbedding(text: string): Promise<number[]> {
  if (provider === "bedrock") {
    const result = await bedrockFetch("/embed", { text });
    return result.embedding || [];
  }
  return geminiModule.generateEmbedding(text);
}

export async function analyzeKnowledgeGaps(notes: any[], results: any[]) {
  if (provider === "bedrock") {
    const result = await bedrockFetch("/generate", {
      prompt: `
        Analyze the following study notes and quiz results to identify knowledge gaps.
        Notes: ${notes.map((n) => n.title).join(", ")}
        Results: ${results.map((r) => `${r.score}/${r.total}`).join(", ")}

        Return a JSON object with:
        - gaps: string[]
        - recommendations: string[]
        - strengthAreas: string[]
      `,
      jsonMode: true,
    });
    return JSON.parse(result.text);
  }
  return geminiModule.analyzeKnowledgeGaps(notes, results);
}

export async function generateQuizFromNotes(
  notes: any[],
  attachments: any[] = [],
  mistakeContext?: string,
  namespaceName?: string,
  scopeName?: string
) {
  if (provider === "bedrock") {
    const prompt = `
      Generate a quiz based on the following study notes and attached PDF document contents.
      ${namespaceName ? `Current Namespace (Subject): ${namespaceName}` : ""}
      ${scopeName ? `Current Scope (Context): ${scopeName}` : ""}
      ${mistakeContext ? `Focus on these areas where I made mistakes: ${mistakeContext}` : ""}

      ${namespaceName && !scopeName ? "Since this is a Namespace-level quiz, try to include questions that compare different platforms or contexts mentioned in the notes/documents, highlighting their differences." : ""}

      Study Notes:
      ${notes.map((n) => `- ${n.title}: ${n.content}`).join("\n")}

      Attached Document Contents:
      ${attachments.map((a) => `- Document ${a.name}: ${a.content}`).join("\n")}

      Return a JSON array of questions, each with:
      - question: string
      - options: string[]
      - correctIndex: number
      - explanation: string (Explain why the answer is correct and reference the specific note title or document name used as the source)
    `;

    const result = await bedrockFetch("/generate", { prompt, jsonMode: true });
    return JSON.parse(result.text);
  }
  return geminiModule.generateQuizFromNotes(notes, attachments, mistakeContext, namespaceName, scopeName);
}

export async function extractTopicsAndAnalyze(questions: any[], results: any[], currentAnalysis: any[]) {
  if (provider === "bedrock") {
    const prompt = `
      Analyze the following quiz questions and results to extract topics and calculate mastery levels.
      Questions: ${JSON.stringify(questions.map((q) => q.question))}
      Results: ${JSON.stringify(results.map((r) => ({ score: r.score, total: r.totalQuestions })))}
      Current Analysis: ${JSON.stringify(currentAnalysis)}

      For each topic identified:
      1. Calculate a new masteryLevel (0-100) based on performance.
      2. Calculate improvement (trend) compared to currentAnalysis.

      Return a JSON array of objects:
      - topic: string
      - masteryLevel: number
      - improvement: number
    `;

    const result = await bedrockFetch("/generate", { prompt, jsonMode: true });
    return JSON.parse(result.text);
  }
  return geminiModule.extractTopicsAndAnalyze(questions, results, currentAnalysis);
}

export async function generateFlashcardsFromNotes(notes: any[], existingFlashcards: any[] = []) {
  if (provider === "bedrock") {
    const prompt = `
      Generate a set of flashcards based on the following study notes.
      Each flashcard should have a 'front' (question or term) and a 'back' (answer or definition).

      IMPORTANT: Do NOT generate flashcards that are duplicates or very similar to the following existing flashcards:
      ${existingFlashcards.map((f) => `- Front: ${f.front}`).join("\n")}

      Study Notes:
      ${notes.map((n) => `- ${n.title}: ${n.content}`).join("\n")}

      Return a JSON array of flashcards, each with:
      - front: string
      - back: string
    `;

    const result = await bedrockFetch("/generate", { prompt, jsonMode: true });
    return JSON.parse(result.text);
  }
  return geminiModule.generateFlashcardsFromNotes(notes, existingFlashcards);
}

export async function summarizeNote(title: string, content: string) {
  if (provider === "bedrock") {
    const prompt = `
      Summarize the following study note into a concise overview.
      Focus on the key points, main arguments, and essential takeaways.
      Use bullet points if appropriate.

      Title: ${title}
      Content: ${content}

      Return the summary as a plain string (Markdown format is allowed).
    `;

    const result = await bedrockFetch("/generate", { prompt });
    return result.text;
  }
  return geminiModule.summarizeNote(title, content);
}

// ============= Agent Functions =============

export async function generateModulesFromAI(description: string) {
  if (provider === "bedrock") {
    const result = await bedrockFetch("/generate", {
      prompt: `Generate a module structure for: ${description}

You MUST return ONLY a valid JSON object with this exact structure:
{
  "modules": [
    {
      "name": "Module Name",
      "description": "Module description",
      "submodules": [
        {
          "name": "Submodule Name",
          "description": "Submodule description"
        }
      ]
    }
  ]
}

Do not include any markdown formatting, code blocks, or explanation. Only return the JSON object.`,
      systemPrompt: `You are an expert curriculum designer. Your task is to take a high-level description of a subject or certification and break it down into a logical structure of modules and submodules. Each module should represent a major topic area. Each submodule should represent a specific concept or sub-topic within that module.`,
      jsonMode: true,
    });

    try {
      const data = JSON.parse(result.text);
      return data.modules || [];
    } catch (error) {
      console.error("Failed to parse modules JSON:", result.text, error);
      return [];
    }
  }
  return agentModule.generateModulesFromAI(description);
}

export async function organizeQuickNote(
  text: string,
  imageBase64?: string,
  availableModules: any[] = [],
  onNoteCallback?: (note: any) => void
) {
  if (provider === "bedrock") {
    // Try streaming endpoint first
    if (onNoteCallback) {
      try {
        const response = await fetch("/api/ai/organize-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            systemPrompt: getOrgganizeSystemPrompt(availableModules),
            availableModules,
          }),
        });

        if (!response.ok) throw new Error("Streaming failed");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let buffer = "";
        const notes: any[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "note") {
                  notes.push(data.data);
                  if (onNoteCallback) onNoteCallback(data.data);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }

        return notes;
      } catch (error) {
        console.error("Streaming error, falling back to regular fetch:", error);
        // Fall through to regular fetch
      }
    }

    // Fallback to regular fetch
    const result = await bedrockFetch("/generate", {
      prompt: `Organize this note: ${text}`,
      systemPrompt: getOrgganizeSystemPrompt(availableModules),
      jsonMode: true,
      image: imageBase64,
    });

    const data = JSON.parse(result.text);
    return data.notes || [];
  }
  return agentModule.organizeQuickNote(text, imageBase64, availableModules);
}

function getOrgganizeSystemPrompt(availableModules: any[]): string {
  return `You are an expert study assistant for Learning Master AI.
    Your task is to take raw, messy notes (and optional images) and organize them into structured, high-quality study notes.

    CORE GUIDELINES:
    1. SPLIT BY TOPIC: If the input contains multiple distinct topics or concepts, split them into SEPARATE notes.

    2. MODULE SELECTION: Assign each note to the most relevant module from the provided list.
       - You MUST use the EXACT ID (e.g., "uuid-123") from the "Available Modules" list below.
       - If the input text strongly relates to a module's name or description, you MUST use that moduleId.
       - If multiple modules seem relevant, pick the most specific one.
       - If NO module is relevant, leave moduleId empty.

    3. CONTENT FORMATTING - Use Markdown with the following structure:
       - Start with a brief 1-2 sentence definition or overview if applicable
       - Use ## for main section headings (Key Concepts, Examples, Steps, etc.)
       - Use ### for subsections
       - Use bullet points (•) for lists of related items
       - Use numbered lists (1., 2., 3.) for sequential steps or ordered information
       - **Bold** important terms and definitions
       - Use code blocks (with triple backticks) for formulas, code, or technical content
       - Separate major sections with blank lines for readability
       - Keep paragraphs concise (2-3 sentences max)
       - Use tables for comparing concepts or data

    4. STRUCTURE REQUIREMENTS:
       - Include a "Key Concepts" section highlighting main ideas
       - Add practical "Examples" or "Applications" when relevant
       - List important formulas, equations, or syntax in dedicated sections

    5. CATEGORIES: Extract 1-3 relevant categories per note (use broad topic areas).
       Examples: Science, Mathematics, History, Literature, Technology, Health, Business, etc.

    6. IMAGES: If an image is provided, describe its key educational content in a dedicated section:
       - Create an "Image Content" or "Visual Reference" section
       - Describe what the image shows and why it's important
       - Relate the image content back to the main concepts

    7. QUALITY STANDARDS:
       - Remove redundancy and repetition
       - Correct spelling and grammar
       - Use consistent terminology throughout
       - Ensure logical flow from simple to complex concepts
       - Highlight prerequisite knowledge when relevant

    Available Modules:
    ${availableModules.length > 0 ? availableModules.map((m) => `- [ID: ${m.id}] ${m.name}: ${m.description}`).join("\n") : "None available. Please leave moduleId empty."}`;
}

export async function generateKanbanTasks(
  planDescription: string,
  modules: any[],
  dueDate?: string
) {
  if (provider === "bedrock") {
    const result = await bedrockFetch("/generate", {
      prompt: `Generate a list of study tasks for this learning plan: ${planDescription}
Modules: ${JSON.stringify(modules)}
Overall Due Date: ${dueDate || "Not specified"}

You MUST return ONLY a valid JSON object with this exact structure:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "Task description",
      "status": "todo",
      "dueDate": "2026-04-20"
    }
  ]
}

Do not include any markdown formatting, code blocks, or explanation. Only return the JSON object.`,
      systemPrompt: `You are an expert project manager for students. Your task is to create a comprehensive list of actionable study tasks (Kanban cards) based on a learning plan and its modules. Create tasks for each module and submodule. Include tasks for "Initial Review", "Deep Dive", "Practice Quiz", and "Final Review". Distribute due dates logically if an overall due date is provided. Tasks should be actionable (e.g., "Complete Module 1 Practice Quiz").`,
      jsonMode: true,
    });

    try {
      const data = JSON.parse(result.text);
      return data.tasks || [];
    } catch (error) {
      console.error("Failed to parse tasks JSON:", result.text, error);
      return [];
    }
  }
  return agentModule.generateKanbanTasks(planDescription, modules, dueDate);
}

export async function askStudyAssistant(
  question: string,
  history: { role: string; content: string }[] = [],
  context: { learningPlanId?: string; moduleId?: string; callbacks: any; notes?: any[] },
  onToken?: (token: string) => void
) {
  if (provider === "bedrock") {
    return bedrockAskStudyAssistant(question, history, context, onToken);
  }
  return agentModule.askStudyAssistant(question, history, context, onToken);
}

// ============= Bedrock-specific streaming chat implementation =============

async function bedrockAskStudyAssistant(
  question: string,
  history: { role: string; content: string }[] = [],
  context: { learningPlanId?: string; moduleId?: string; callbacks: any; notes?: any[] },
  onToken?: (token: string) => void
): Promise<string> {
  const messages = history.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
  messages.push({ role: "user", content: question });

  const systemPrompt = `You are a powerful study assistant for Learning Master AI with the ability to control the application interface.

    ${context.notes ? `CONTEXT NOTES PROVIDED BY USER:
    ${context.notes.map((n) => `Title: ${n.title}\nContent: ${n.content}`).join("\n---\n")}

    Please focus your answers on the context provided above if relevant.` : ""}

    Capabilities:
    1. Search: Find relevant information in existing notes.
    2. Add Notes: If you learn something new or summarize a topic, add it as a note for the user.
    3. Navigate: Help the user find things by switching views or filters.
    4. Export: Generate a "book" of notes for the user to download.

    Guidelines:
    - Always use the search_notes tool if you need information you don't have.
    - If the user asks to "save this" or "remember this", use add_note.
    - If the user asks to "show me my notes" or "go to quizzes", use navigate_to.
    - If the user wants a summary of everything, use export_book.
    - Be proactive. If a conversation leads to a good summary, offer to save it as a note.
    - Cite your sources by note title.`;

  const tools = [
    {
      name: "search_notes",
      description: "Search for relevant study notes using semantic vector search.",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "The search query to find relevant notes" },
        },
        required: ["query"],
      },
    },
    {
      name: "add_note",
      description: "Create a new study note based on the conversation.",
      inputSchema: {
        type: "object" as const,
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          categories: { type: "array", items: { type: "string" } },
          learningPlanId: { type: "string" },
          moduleId: { type: "string" },
        },
        required: ["title", "content", "categories"],
      },
    },
    {
      name: "navigate_to",
      description: "Change the current view or filter in the application.",
      inputSchema: {
        type: "object" as const,
        properties: {
          view: {
            type: "string",
            enum: ["dashboard", "notes", "quizzes", "learning"],
          },
          learningPlanId: { type: "string" },
          moduleId: { type: "string" },
        },
        required: ["view"],
      },
    },
  ];

  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        systemPrompt,
        notes: context.notes || [],
        tools,
        learningPlanId: context.learningPlanId,
        moduleId: context.moduleId,
        callbacks: {
          onAddNote: context.callbacks.onAddNote ? "true" : "false",
          onNavigate: context.callbacks.onNavigate ? "true" : "false",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat API error: ${response.statusText}`);
    }

    let fullText = "";
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);

            if (event.type === "token" && event.text) {
              fullText += event.text;
              if (onToken) onToken(event.text);
            } else if (event.type === "tool_call") {
              // Handle UI tool calls from server
              const toolName = event.name;
              const args = event.args || {};

              if (toolName === "add_note" && context.callbacks.onAddNote) {
                await context.callbacks.onAddNote(args);
              } else if (toolName === "navigate_to" && context.callbacks.onNavigate) {
                context.callbacks.onNavigate(args);
              }
            }
          } catch (e) {
            // Skip invalid JSON lines (like empty lines)
          }
        }
      }
    }

    return fullText || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("bedrockAskStudyAssistant failed:", error);
    return "I encountered an error while processing your request.";
  }
}
