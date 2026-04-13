import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: [{
        parts: [{ text }]
      }]
    });
    
    return response.embeddings[0].values;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return [];
  }
}

export async function analyzeKnowledgeGaps(notes: any[], results: any[]) {
  const prompt = `
    Analyze the following study notes and quiz results to identify knowledge gaps.
    Notes: ${notes.map(n => n.title).join(", ")}
    Results: ${results.map(r => `${r.score}/${r.total}`).join(", ")}
    
    Return a JSON object with:
    - gaps: string[]
    - recommendations: string[]
    - strengthAreas: string[]
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text);
}

export async function generateQuizFromNotes(notes: any[], attachments: any[] = [], mistakeContext?: string, namespaceName?: string, scopeName?: string) {
  const prompt = `
    Generate a quiz based on the following study notes and attached PDF document contents.
    ${namespaceName ? `Current Namespace (Subject): ${namespaceName}` : ""}
    ${scopeName ? `Current Scope (Context): ${scopeName}` : ""}
    ${mistakeContext ? `Focus on these areas where I made mistakes: ${mistakeContext}` : ''}
    
    ${namespaceName && !scopeName ? "Since this is a Namespace-level quiz, try to include questions that compare different platforms or contexts mentioned in the notes/documents, highlighting their differences." : ""}

    Study Notes:
    ${notes.map(n => `- ${n.title}: ${n.content}`).join('\n')}

    Attached Document Contents:
    ${attachments.map(a => `- Document ${a.name}: ${a.content}`).join('\n')}
    
    Return a JSON array of questions, each with:
    - question: string
    - options: string[]
    - correctIndex: number
    - explanation: string (Explain why the answer is correct and reference the specific note title or document name used as the source)
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text);
}

export async function extractTopicsAndAnalyze(questions: any[], results: any[], currentAnalysis: any[]) {
  const prompt = `
    Analyze the following quiz questions and results to extract topics and calculate mastery levels.
    Questions: ${JSON.stringify(questions.map(q => q.question))}
    Results: ${JSON.stringify(results.map(r => ({ score: r.score, total: r.totalQuestions })))}
    Current Analysis: ${JSON.stringify(currentAnalysis)}
    
    For each topic identified:
    1. Calculate a new masteryLevel (0-100) based on performance.
    2. Calculate improvement (trend) compared to currentAnalysis.
    
    Return a JSON array of objects:
    - topic: string
    - masteryLevel: number
    - improvement: number
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text);
}

export async function generateFlashcardsFromNotes(notes: any[], existingFlashcards: any[] = []) {
  const prompt = `
    Generate a set of flashcards based on the following study notes.
    Each flashcard should have a 'front' (question or term) and a 'back' (answer or definition).
    
    IMPORTANT: Do NOT generate flashcards that are duplicates or very similar to the following existing flashcards:
    ${existingFlashcards.map(f => `- Front: ${f.front}`).join('\n')}

    Study Notes:
    ${notes.map(n => `- ${n.title}: ${n.content}`).join('\n')}
    
    Return a JSON array of flashcards, each with:
    - front: string
    - back: string
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text);
}
