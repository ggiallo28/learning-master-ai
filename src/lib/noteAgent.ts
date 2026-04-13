import { GoogleGenAI, Type } from "@google/genai";
import { ai } from "./gemini";
import { vectorSearchNotes } from "./db";
import { generateEmbedding } from "./gemini";

export interface OrganizedNote {
  title: string;
  organizedContent: string;
  categories: string[];
  moduleId?: string;
}

export interface GeneratedModule {
  name: string;
  description: string;
  submodules?: {
    name: string;
    description: string;
  }[];
}

export async function generateModulesFromAI(description: string): Promise<GeneratedModule[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a module structure for: ${description}`,
      config: {
        systemInstruction: `You are an expert curriculum designer. 
        Your task is to take a high-level description of a subject or certification and break it down into a logical structure of modules and submodules.
        
        Each module should represent a major topic area.
        Each submodule should represent a specific concept or sub-topic within that module.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            modules: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  submodules: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING }
                      },
                      required: ["name", "description"]
                    }
                  }
                },
                required: ["name", "description"]
              }
            }
          },
          required: ["modules"]
        }
      }
    });

    const data = JSON.parse(response.text);
    return data.modules || [];
  } catch (error) {
    console.error("generateModulesFromAI failed:", error);
    throw error;
  }
}

export async function organizeQuickNote(
  text: string, 
  imageBase64?: string, 
  availableModules: { id: string, name: string, description: string }[] = []
): Promise<OrganizedNote[]> {
  try {
    const parts: any[] = [{ text: `Organize this note: ${text}` }];
    if (imageBase64) {
      parts.push({ inlineData: { mimeType: "image/png", data: imageBase64 } });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: `You are an expert study assistant for Learning Master AI. 
        Your task is to take raw, messy notes (and optional images) and organize them into structured, high-quality study notes.
        
        CRITICAL GUIDELINES:
        1. SPLIT BY TOPIC: If the input contains multiple distinct topics or concepts, split them into SEPARATE notes.
        2. MODULE SELECTION: Assign each note to the most relevant module from the provided list. If a note doesn't fit any module, leave moduleId empty.
        3. FORMATTING: Always use Markdown for the content.
        4. CATEGORIES: Extract 1-3 relevant categories per note.
        5. IMAGES: If an image is provided, describe its key educational content and incorporate it into the relevant note(s).
        
        Available Modules:
        ${availableModules.map(m => `- [ID: ${m.id}] ${m.name}: ${m.description}`).join("\n")}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            notes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  organizedContent: { type: Type.STRING },
                  categories: { type: Type.ARRAY, items: { type: Type.STRING } },
                  moduleId: { type: Type.STRING }
                },
                required: ["title", "organizedContent", "categories"]
              }
            }
          },
          required: ["notes"]
        }
      }
    });

    const data = JSON.parse(response.text);
    return data.notes || [];
  } catch (error) {
    console.error("organizeQuickNote failed:", error);
    // Fallback
    return [{
      title: "Untitled Note",
      organizedContent: text,
      categories: ["General"]
    }];
  }
}

export async function askStudyAssistant(
  question: string, 
  history: { role: string, content: string }[] = [],
  context: { learningPlanId?: string, moduleId?: string, callbacks: any }
) {
  const tools = [
    {
      name: "search_notes",
      description: "Search for relevant study notes using semantic vector search.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: { type: Type.STRING, description: "The search query to find relevant notes" }
        },
        required: ["query"]
      }
    },
    {
      name: "add_note",
      description: "Create a new study note based on the conversation.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          categories: { type: Type.ARRAY, items: { type: Type.STRING } },
          learningPlanId: { type: Type.STRING },
          moduleId: { type: Type.STRING }
        },
        required: ["title", "content", "categories"]
      }
    },
    {
      name: "navigate_to",
      description: "Change the current view or filter in the application.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          view: { type: Type.STRING, enum: ["dashboard", "notes", "quizzes", "learning"] },
          learningPlanId: { type: Type.STRING },
          moduleId: { type: Type.STRING }
        },
        required: ["view"]
      }
    },
    {
      name: "export_book",
      description: "Generate a well-formatted 'book' export of notes in Markdown.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          learningPlanId: { type: Type.STRING },
          moduleId: { type: Type.STRING }
        }
      }
    },
    {
      name: "analyze_progress",
      description: "Navigate to the dashboard and trigger a knowledge analysis to see progress and gaps.",
      parameters: { type: Type.OBJECT, properties: {} }
    },
    {
      name: "create_quiz",
      description: "Navigate to the challenge section to start a new quiz.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          learningPlanId: { type: Type.STRING },
          moduleId: { type: Type.STRING }
        }
      }
    },
    {
      name: "manage_context",
      description: "Switch between different learning plans or modules.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          learningPlanId: { type: Type.STRING },
          moduleId: { type: Type.STRING }
        }
      }
    }
  ];

  const toolHandlers: Record<string, (args: any) => Promise<any>> = {
    search_notes: async ({ query }) => {
      const embedding = await generateEmbedding(query);
      const results = await vectorSearchNotes(embedding, 5, context.learningPlanId, context.moduleId);
      return results.map(n => `[ID: ${n.id}] [Date: ${n.updatedAt}] Title: ${n.title}\nContent: ${n.content}`).join("\n---\n");
    },
    add_note: async (args) => {
      if (context.callbacks.onAddNote) {
        await context.callbacks.onAddNote(args);
        return "Note added successfully.";
      }
      return "Failed to add note: callback not provided.";
    },
    navigate_to: async (args) => {
      if (context.callbacks.onNavigate) {
        context.callbacks.onNavigate(args);
        return `Navigated to ${args.view}.`;
      }
      return "Failed to navigate: callback not provided.";
    },
    export_book: async (args) => {
      if (context.callbacks.onExportBook) {
        const markdown = await context.callbacks.onExportBook(args);
        return `Book generated. Content preview: ${markdown.substring(0, 100)}...`;
      }
      return "Failed to export book: callback not provided.";
    },
    analyze_progress: async () => {
      if (context.callbacks.onNavigate) {
        context.callbacks.onNavigate({ view: "dashboard" });
        return "Navigated to dashboard. You can now trigger the analysis there.";
      }
      return "Failed to analyze progress: callback not provided.";
    },
    create_quiz: async (args) => {
      if (context.callbacks.onNavigate) {
        context.callbacks.onNavigate({ view: "quiz", ...args });
        return "Navigated to Challenge section.";
      }
      return "Failed to create quiz: callback not provided.";
    },
    manage_context: async (args) => {
      if (context.callbacks.onNavigate) {
        context.callbacks.onNavigate({ view: "dashboard", ...args });
        return "Context updated.";
      }
      return "Failed to update context: callback not provided.";
    }
  };

  const messages: any[] = history.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
  messages.push({ role: "user", parts: [{ text: question }] });

  try {
    let response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: messages,
      config: {
        systemInstruction: `You are a powerful study assistant for Learning Master AI with the ability to control the application interface.
        
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
        - Cite your sources by note title.`,
        tools: [{ functionDeclarations: tools }]
      }
    });

    // Handle tool calls loop
    while (response.functionCalls && response.functionCalls.length > 0) {
      const toolResponses = [];
      
      // Add model's full response content to history (includes thought/reasoning)
      messages.push(response.candidates[0].content);

      for (const fc of response.functionCalls) {
        const handler = toolHandlers[fc.name];
        if (handler) {
          const result = await handler(fc.args);
          toolResponses.push({
            functionResponse: {
              name: fc.name,
              response: { result },
              id: fc.id
            }
          });
        }
      }

      // Add tool responses to history
      messages.push({
        role: "user",
        parts: toolResponses
      });

      // Call model again with tool results
      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages,
        config: {
          tools: [{ functionDeclarations: tools }]
        }
      });
    }

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("askStudyAssistant failed:", error);
    return "I encountered an error while processing your request.";
  }
}
