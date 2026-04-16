/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Note, QuizResult, AppData, LearningPlan, Module, Quiz, Flashcard, FlashcardSet, Todo } from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NoteEditor } from "./components/NoteEditor";
import { Dashboard } from "./components/Dashboard";
import { Quiz as QuizComponent } from "./components/Quiz";
import { Flashcards } from "./components/Flashcards";
import { KanbanBoard } from "./components/KanbanBoard";
import { BookOpen, LayoutDashboard, BrainCircuit, Settings, Database, RefreshCw, FolderTree, GraduationCap, Download, Sparkles, Plus, Loader2, CreditCard, X, ListTodo, Calendar, MessageSquare } from "lucide-react";
import { Toaster } from "sonner";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  initDB, getNotes, saveNote, deleteNote, getResults, saveResult, clearAndSeed, 
  searchNotes, updateNote, vectorSearchNotes,
  getLearningPlans, saveLearningPlan, deleteLearningPlan,
  getModules, saveModule, deleteModule, getQuizzes, saveQuiz,
  getConversations, saveConversation, getTopicAnalysis, saveTopicAnalysis,
  getInitialAssessments, saveInitialAssessment,
  getFlashcardSets, saveFlashcardSet, deleteFlashcardSet, getFlashcards, saveFlashcard,
  getTodos, saveTodo, deleteTodo, clearConversations
} from "./lib/db";
import { generateEmbedding, extractTopicsAndAnalyze, generateFlashcardsFromNotes, generateQuizFromNotes, organizeQuickNote } from "./lib/ai";
import { ChatAssistant } from "./components/ChatAssistant";
import { LearningBook } from "./components/LearningBook";
import { Management } from "./components/Management";
import { SelectionScreen } from "./components/SelectionScreen";
import { InitialAssessment, Conversation, TopicAnalysis } from "./types";

export default function App() {
  const [data, setData] = useState<AppData>({ 
    notes: [], 
    results: [], 
    learningPlans: [], 
    modules: [], 
    quizzes: [],
    conversations: [],
    topicAnalysis: [],
    initialAssessments: [],
    flashcardSets: [],
    flashcards: [],
    todos: []
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [studySubTab, setStudySubTab] = useState("flashcards");
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Context state
  const [currentLearningPlanId, setCurrentLearningPlanId] = useState<string | undefined>(undefined);
  const [currentModuleId, setCurrentModuleId] = useState<string | undefined>(undefined);

  const formatMarkdown = (content: any) => {
    if (typeof content !== 'string') return JSON.stringify(content);
    return content.replace(/\\n/g, '\n');
  };

  useEffect(() => {
    const setup = async () => {
      try {
        // 1. Fetch initial data from server-side local file
        const res = await fetch("/api/data");
        if (!res.ok) {
          throw new Error(`Failed to fetch initial data: ${res.status}`);
        }
        const initialData = await res.json();
        
        // 2. Initialize DuckDB-Wasm
        await initDB();
        
        // 3. Seed DuckDB with server data
        if (initialData.notes?.length > 0 || initialData.results?.length > 0 || initialData.learningPlans?.length > 0) {
          // Ensure notes have categories array
          const sanitizedNotes = (initialData.notes || []).map((n: any) => ({
            ...n,
            categories: n.categories || (n.category ? [n.category] : [])
          }));
          await clearAndSeed(
            sanitizedNotes, 
            initialData.results || [], 
            initialData.learningPlans || [], 
            initialData.modules || []
          );
        }
        
        await refreshData();
      } catch (error) {
        console.error("Initialization failed", error);
        toast.error("Failed to initialize system");
      } finally {
        setLoading(false);
      }
    };
    setup();
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (loading) return;
      try {
        if (!searchQuery.trim()) {
          const allNotes = await getNotes(currentLearningPlanId, currentModuleId);
          setData(prev => ({ ...prev, notes: allNotes }));
          return;
        }

        // Semantic search for longer queries, FTS for shorter ones
        if (searchQuery.length > 10) {
          const embedding = await generateEmbedding(searchQuery);
          const results = await vectorSearchNotes(embedding, 10, currentLearningPlanId, currentModuleId);
          setData(prev => ({ ...prev, notes: results }));
        } else {
          const results = await searchNotes(searchQuery, currentLearningPlanId, currentModuleId);
          setData(prev => ({ ...prev, notes: results }));
        }
      } catch (error) {
        console.error("Search failed", error);
      }
    };
    
    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, loading, currentLearningPlanId, currentModuleId]);

  const refreshData = async () => {
    try {
      const [notes, results, learningPlans, modules, quizzes, conversations, topicAnalysis, initialAssessments, flashcardSets, todos] = await Promise.all([
        getNotes(currentLearningPlanId, currentModuleId), 
        getResults(),
        getLearningPlans(),
        getModules(),
        getQuizzes(currentLearningPlanId, currentModuleId),
        getConversations(currentLearningPlanId),
        getTopicAnalysis(currentLearningPlanId),
        getInitialAssessments(),
        getFlashcardSets(currentLearningPlanId, currentModuleId),
        getTodos(currentLearningPlanId, currentModuleId)
      ]);

      const flashcards: Flashcard[] = [];
      for (const set of flashcardSets) {
        const cards = await getFlashcards(set.id);
        flashcards.push(...cards);
      }

      const newData = { notes, results, learningPlans, modules, quizzes, conversations, topicAnalysis, initialAssessments, flashcardSets, flashcards, todos };
      setData(newData);
      return newData;
    } catch (error) {
      toast.error("Failed to load data from DuckDB");
      return { 
        notes: [], results: [], learningPlans: [], modules: [], quizzes: [], 
        conversations: [], topicAnalysis: [], initialAssessments: [],
        flashcardSets: [], flashcards: [], todos: []
      };
    }
  };

  const syncWithServer = async (currentData: AppData, retryCount = 0) => {
    setIsSyncing(true);
    console.log(`[Sync] Starting sync. Attempt: ${retryCount + 1}. Data size: ${JSON.stringify(currentData).length} bytes`);
    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentData, (_, value) => 
          typeof value === 'bigint' ? Number(value) : value
        ),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Sync] Server error: ${response.status} - ${errorText}`);
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      console.log("[Sync] Sync successful");
    } catch (error) {
      console.error("[Sync] Sync failed", error);
      if (retryCount < 2) {
        console.log(`[Sync] Retrying sync... (${retryCount + 1})`);
        setTimeout(() => syncWithServer(currentData, retryCount + 1), 1000);
      } else {
        toast.error(`Sync failed: ${error instanceof Error ? error.message : "Network error"}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddNote = async (note: Note) => {
    console.log("Adding note:", note);
    try {
      const embedding = await generateEmbedding(`${note.title} ${note.content} ${note.categories.join(' ')}`);
      console.log("Generated embedding:", embedding.length);
      
      // Use provided IDs if available, otherwise fallback to current state
      const learningPlanId = note.learningPlanId || currentLearningPlanId;
      const moduleId = note.moduleId || currentModuleId;
      
      await saveNote({ 
        ...note, 
        embedding, 
        learningPlanId, 
        moduleId 
      });
      
      const newData = await refreshData();
      console.log("Data refreshed, syncing...");
      await syncWithServer(newData);
      toast.success("Note saved and persisted!");
    } catch (error) {
      console.error("Failed to save note:", error);
      toast.error("Failed to save note");
    }
  };

  const handleUpdateNote = async (note: Note) => {
    try {
      const embedding = await generateEmbedding(`${note.title} ${note.content} ${note.categories.join(' ')}`);
      await updateNote({ ...note, embedding });
      const newData = await refreshData();
      await syncWithServer(newData);
      toast.success("Note updated!");
    } catch (error) {
      toast.error("Failed to update note");
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await deleteNote(id);
      const newData = await refreshData();
      await syncWithServer(newData);
      toast.success("Note deleted and sync completed");
    } catch (error) {
      toast.error("Failed to delete note");
    }
  };

  const handleAddTodo = async (todo: Todo) => {
    try {
      await saveTodo(todo);
      const newData = await refreshData();
      await syncWithServer(newData);
    } catch (error) {
      toast.error("Failed to add task");
    }
  };

  const handleUpdateTodo = async (todo: Todo) => {
    try {
      await saveTodo(todo);
      const newData = await refreshData();
      await syncWithServer(newData);
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await deleteTodo(id);
      const newData = await refreshData();
      await syncWithServer(newData);
      toast.success("Task removed");
    } catch (error) {
      toast.error("Failed to delete task");
    }
  };

  const handleAddResult = async (result: QuizResult) => {
    try {
      await saveResult(result);
      
      // Update topic analysis
      const quiz = data.quizzes.find(q => q.id === result.quizId);
      if (quiz) {
        const analysis = await extractTopicsAndAnalyze(quiz.questions, [result], data.topicAnalysis);
        for (const item of analysis) {
          await saveTopicAnalysis({
            id: crypto.randomUUID(),
            learningPlanId: currentLearningPlanId || "global",
            moduleId: currentModuleId,
            topic: item.topic,
            score: result.score,
            masteryLevel: item.masteryLevel,
            improvement: item.improvement,
            lastUpdated: new Date().toISOString()
          });
        }
      }

      const newData = await refreshData();
      await syncWithServer(newData);
    } catch (error) {
      console.error("Failed to save quiz result:", error);
      toast.error("Failed to save quiz result");
    }
  };

  const handleAddLearningPlan = async (lp: LearningPlan) => {
    try {
      await saveLearningPlan(lp);
      
      // Create a default "Global" module for this learning plan
      const globalModule: Module = {
        id: crypto.randomUUID(),
        learningPlanId: lp.id,
        name: "Global",
        description: "Default module for unorganized notes",
        createdAt: new Date().toISOString()
      };
      await saveModule(globalModule);

      const newData = await refreshData();
      await syncWithServer(newData);
      toast.success("Learning Plan created!");
      if (!currentLearningPlanId) {
        setCurrentLearningPlanId(lp.id);
        setCurrentModuleId(globalModule.id);
      }
    } catch (error) {
      toast.error("Failed to create learning plan");
    }
  };

  const handleUpdateLearningPlan = async (lp: LearningPlan) => {
    try {
      await saveLearningPlan(lp);
      const newData = await refreshData();
      await syncWithServer(newData);
      toast.success("Learning Plan updated!");
    } catch (error) {
      toast.error("Failed to update learning plan");
    }
  };

  const handleDeleteLearningPlan = async (id: string) => {
    try {
      await deleteLearningPlan(id);
      if (currentLearningPlanId === id) {
        setCurrentLearningPlanId(undefined);
        setCurrentModuleId(undefined);
      }
      const newData = await refreshData();
      await syncWithServer(newData);
      toast.success("Learning Plan deleted");
    } catch (error) {
      toast.error("Failed to delete learning plan");
    }
  };

  const handleAddModule = async (module: Module) => {
    try {
      await saveModule(module);
      const newData = await refreshData();
      await syncWithServer(newData);
      toast.success("Module created!");
      if (!currentModuleId) setCurrentModuleId(module.id);
    } catch (error) {
      toast.error("Failed to create module");
    }
  };

  const handleUpdateModule = async (module: Module) => {
    try {
      await saveModule(module);
      const newData = await refreshData();
      await syncWithServer(newData);
      toast.success("Module updated!");
    } catch (error) {
      toast.error("Failed to update module");
    }
  };

  const handleDeleteModule = async (id: string) => {
    try {
      await deleteModule(id);
      if (currentModuleId === id) setCurrentModuleId(undefined);
      const newData = await refreshData();
      await syncWithServer(newData);
      toast.success("Module deleted");
    } catch (error) {
      toast.error("Failed to delete module");
    }
  };

  const handleAddAssessment = async (assessment: InitialAssessment) => {
    try {
      await saveInitialAssessment(assessment);
      const newData = await refreshData();
      await syncWithServer(newData);
    } catch (error) {
      toast.error("Failed to save assessment");
    }
  };

  const handleAddFlashcardSet = async (set: FlashcardSet, cards: Flashcard[]) => {
    try {
      await saveFlashcardSet(set);
      for (const card of cards) {
        await saveFlashcard(card);
      }
      const newData = await refreshData();
      await syncWithServer(newData);
    } catch (error) {
      toast.error("Failed to save flashcard set");
    }
  };

  const handleDeleteFlashcardSet = async (id: string) => {
    try {
      await deleteFlashcardSet(id);
      const newData = await refreshData();
      await syncWithServer(newData);
      toast.success("Flashcard set deleted");
    } catch (error) {
      toast.error("Failed to delete flashcard set");
    }
  };

  const handleMarkFlashcardLearned = async (cardId: string, learned: boolean) => {
    try {
      const card = data.flashcards.find(c => c.id === cardId);
      if (!card) {
        toast.error("Flashcard not found");
        return;
      }

      const updatedCard: Flashcard = {
        ...card,
        learned,
        updatedAt: new Date().toISOString()
      };

      await saveFlashcard(updatedCard);
      const newData = await refreshData();
      await syncWithServer(newData);
    } catch (error) {
      console.error("Failed to update flashcard:", error);
      toast.error("Failed to mark flashcard");
    }
  };

  const handleExportBook = async (args: { learningPlanId?: string; moduleId?: string }) => {
    const notesToExport = await getNotes(args.learningPlanId, args.moduleId);
    if (notesToExport.length === 0) {
      toast.error("No notes found to export.");
      return "";
    }

    let markdown = `# Learning Master - Study Book\n\n`;
    markdown += `Generated on: ${new Date().toLocaleString()}\n\n`;

    if (args.learningPlanId) {
      const lp = data.learningPlans.find(l => l.id === args.learningPlanId);
      markdown += `## Subject: ${lp?.name || "Unknown"}\n\n`;
    }

    notesToExport.forEach(note => {
      markdown += `### ${note.title}\n\n`;
      markdown += `${note.content}\n\n`;
      markdown += `*Categories: ${note.categories.join(", ")}*\n`;
      markdown += `*Last Updated: ${new Date(note.updatedAt).toLocaleDateString()}*\n\n`;
      markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LearningMaster_StudyBook_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Study book exported successfully!");
    return markdown;
  };

  const handleSaveConversation = async (conv: Conversation) => {
    try {
      await saveConversation(conv);
      const newData = await refreshData();
      await syncWithServer(newData);
    } catch (error) {
      console.error("Failed to save conversation", error);
    }
  };

  const agentCallbacks = {
    onAddNote: async (noteArgs: any) => {
      const moduleId = noteArgs.moduleId || currentModuleId;
      if (!moduleId) {
        toast.error("Agent tried to add a note but no module was selected. Please select a module first.");
        return;
      }
      const newNote: Note = {
        id: crypto.randomUUID(),
        title: noteArgs.title,
        content: noteArgs.content,
        categories: noteArgs.categories,
        learningPlanId: noteArgs.learningPlanId || currentLearningPlanId,
        moduleId: moduleId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await handleAddNote(newNote);
    },
    onNavigate: (args: any) => {
      if (args.view) {
        if (args.view === "quiz") {
          setActiveTab("flashcards");
          setStudySubTab("quiz");
        } else {
          setActiveTab(args.view === "learning" ? "notes" : args.view);
        }
      }
      if (args.learningPlanId) setCurrentLearningPlanId(args.learningPlanId);
      if (args.moduleId) setCurrentModuleId(args.moduleId);
      toast.info(`Agent navigated to ${args.view}`);
    },
    onExportBook: handleExportBook,
    onSaveConversation: handleSaveConversation,
    onClearHistory: async () => {
      try {
        await clearConversations(currentLearningPlanId);
        const newData = await refreshData();
        await syncWithServer(newData);
      } catch (error) {
        console.error("Failed to clear history", error);
      }
    }
  };

  const handleSaveQuiz = async (quiz: any) => {
    try {
      await saveQuiz(quiz);
      const newData = await refreshData();
      await syncWithServer(newData);
    } catch (error) {
      toast.error("Failed to save quiz");
    }
  };

  const isSetupRequired = data.learningPlans.length === 0;
  const effectiveTab = activeTab;

  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);
  const [quickInput, setQuickInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [followUpNote, setFollowUpNote] = useState<Note | null>(null);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't trigger if we're already in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      let hasContent = false;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
              setSelectedImage(reader.result as string);
              setIsQuickNoteOpen(true);
            };
            reader.readAsDataURL(file);
            hasContent = true;
          }
        } else if (items[i].type === "text/plain") {
          items[i].getAsString((text) => {
            if (text.trim()) {
              setQuickInput((prev) => prev ? prev + "\n" + text : text);
              setIsQuickNoteOpen(true);
            }
          });
          hasContent = true;
        }
      }

      if (hasContent) {
        toast.info("Pasted content captured by AI Organizer");
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, []);

  const handleQuickOrganize = async () => {
    if (!quickInput && !selectedImage) return;
    
    // Close modal immediately
    setIsQuickNoteOpen(false);
    
    // Create a temporary placeholder note
    const placeholderId = crypto.randomUUID();
    const placeholderNote: Note = {
      id: placeholderId,
      title: "AI is Organizing...",
      content: "",
      categories: [],
      isPlaceholder: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add placeholder to state immediately
    await handleAddNote(placeholderNote);
    
    // Run organization in background
    (async () => {
      try {
        const availableModules = data.modules.map(m => ({ id: m.id, name: m.name, description: m.description }));
        const organizedNotes = await organizeQuickNote(quickInput, selectedImage?.split(",")[1], availableModules);
        
        // Remove placeholder
        await deleteNote(placeholderId);
        setData(prev => ({
          ...prev,
          notes: prev.notes.filter(n => n.id !== placeholderId)
        }));

        for (const organized of organizedNotes) {
          const newNote: Note = {
            id: crypto.randomUUID(),
            title: organized.title,
            content: organized.content || organized.organizedContent,
            rawContent: quickInput,
            categories: organized.categories || [],
            learningPlanId: currentLearningPlanId,
            moduleId: organized.moduleId || currentModuleId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await handleAddNote(newNote);
        }
        
        toast.success(`AI organized ${organizedNotes.length} note(s)!`);
      } catch (error) {
        console.error("Quick organize error:", error);
        toast.error("Failed to organize note.");
        // Cleanup placeholder on error
        await deleteNote(placeholderId);
        setData(prev => ({
          ...prev,
          notes: prev.notes.filter(n => n.id !== placeholderId)
        }));
      }
    })();

    setQuickInput("");
    setSelectedImage(null);
  };

  const handleGenerateFlashcards = async () => {
    let relevantNotes = data.notes.filter(n => {
      if (currentModuleId) return n.moduleId === currentModuleId;
      if (currentLearningPlanId) return n.learningPlanId === currentLearningPlanId;
      return true;
    });

    if (relevantNotes.length === 0) {
      toast.error("No notes found to generate flashcards from.");
      return;
    }

    // Check for duplicates: Does a set already exist with these exact notes?
    const relevantNoteIds = relevantNotes.map(n => n.id).sort();
    const existingSet = data.flashcardSets.find(set => {
      if (!set.noteIds) return false;
      const setNoteIds = [...set.noteIds].sort();
      return JSON.stringify(setNoteIds) === JSON.stringify(relevantNoteIds);
    });

    if (existingSet) {
      toast.info("A flashcard set for these notes already exists.", {
        description: "You can find it in your study materials."
      });
      return;
    }

    // Filter out notes that have already been used in any flashcard set
    const usedNoteIds = new Set<string>();
    for (const set of data.flashcardSets) {
      if (set.noteIds) {
        set.noteIds.forEach(id => usedNoteIds.add(id));
      }
    }

    const unusedNotes = relevantNotes.filter(n => !usedNoteIds.has(n.id));

    if (unusedNotes.length === 0) {
      toast.info("All relevant notes have already been used to create flashcard sets.", {
        description: "Try selecting different notes or create a new learning plan."
      });
      return;
    }

    if (unusedNotes.length < relevantNotes.length) {
      toast.info(`${relevantNotes.length - unusedNotes.length} note(s) already used in other sets. Generating from ${unusedNotes.length} new note(s).`);
    }

    setIsGeneratingFlashcards(true);
    try {
      const generated = await generateFlashcardsFromNotes(unusedNotes, data.flashcards);
      const setId = crypto.randomUUID();
      const newSet: FlashcardSet = {
        id: setId,
        title: `AI Generated: ${unusedNotes[0]?.title || "Study Set"}`,
        description: `Generated from ${unusedNotes.length} notes`,
        learningPlanId: currentLearningPlanId,
        moduleId: currentModuleId,
        noteIds: unusedNotes.map(n => n.id),
        createdAt: new Date().toISOString()
      };

      const newCards: Flashcard[] = generated.map((g: any) => ({
        id: crypto.randomUUID(),
        setId,
        front: g.front,
        back: g.back,
        createdAt: new Date().toISOString()
      }));

      await handleAddFlashcardSet(newSet, newCards);
      toast.success(`Generated ${newCards.length} flashcards!`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate flashcards.");
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
        <div className="animate-spin text-indigo-600">
          <Database className="w-12 h-12" />
        </div>
        <div className="animate-pulse text-zinc-600 font-medium text-lg">Initializing In-Process DuckDB...</div>
      </div>
    );
  }

  if (!currentLearningPlanId) {
    return (
      <SelectionScreen 
        learningPlans={data.learningPlans}
        onSelect={(id) => setCurrentLearningPlanId(id)}
        onCreate={handleAddLearningPlan}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-50/50 dark:bg-zinc-950 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex flex-col gap-6 px-8 py-6 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl border-b shrink-0">
          {/* Top Bar */}
          <div className="max-w-[1600px] w-full mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl shadow-md">
                <BrainCircuit className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Learning Master
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-mono uppercase tracking-widest">v1.0</span>
              </h1>
            </div>

            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1.5 rounded-full border shadow-md">
              <Button 
                variant={activeTab === "dashboard" ? "default" : "ghost"} 
                size="lg"
                onClick={() => setActiveTab("dashboard")}
                className={`gap-3 rounded-full h-12 px-6 text-base font-bold transition-all ${activeTab === "dashboard" ? "shadow-lg shadow-indigo-100" : ""}`}
              >
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </Button>
              <Button 
                variant={activeTab === "kanban" ? "default" : "ghost"} 
                size="lg"
                onClick={() => setActiveTab("kanban")}
                className={`gap-3 rounded-full h-12 px-6 text-base font-bold transition-all ${activeTab === "kanban" ? "shadow-lg shadow-indigo-100" : ""}`}
              >
                <ListTodo className="w-5 h-5" />
                Kanban
              </Button>
              <Button 
                variant={activeTab === "notes" ? "default" : "ghost"} 
                size="lg"
                onClick={() => setActiveTab("notes")}
                className={`gap-3 rounded-full h-12 px-6 text-base font-bold transition-all ${activeTab === "notes" ? "shadow-lg shadow-indigo-100" : ""}`}
              >
                <BookOpen className="w-5 h-5" />
                Notes
              </Button>
              <Button 
                variant={activeTab === "flashcards" ? "default" : "ghost"} 
                size="lg"
                onClick={() => {
                  setActiveTab("flashcards");
                  setStudySubTab("flashcards");
                }}
                className={`gap-3 rounded-full h-12 px-6 text-base font-bold transition-all ${activeTab === "flashcards" ? "shadow-lg shadow-indigo-100" : ""}`}
              >
                <GraduationCap className="w-5 h-5" />
                Study
              </Button>
              <Button 
                variant={activeTab === "management" ? "default" : "ghost"} 
                size="lg"
                onClick={() => setActiveTab("management")}
                className={`gap-3 rounded-full h-12 px-6 text-base font-bold transition-all ${activeTab === "management" ? "shadow-lg shadow-indigo-100" : ""}`}
              >
                <Settings className="w-5 h-5" />
                Manage
              </Button>
            </div>
          </div>

          {/* Sub Bar */}
          <div className="max-w-[1600px] w-full mx-auto flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentLearningPlanId(undefined)}
                className="text-zinc-500 hover:text-indigo-600 gap-2 h-9 rounded-full border-zinc-200 bg-white dark:bg-zinc-900 shadow-sm text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Switch Path
              </Button>
              <div className="flex items-center gap-3 px-4 py-1.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full text-sm font-medium border shadow-sm">
                <FolderTree className="w-4 h-4 text-indigo-500" />
                {data.learningPlans.find(lp => lp.id === currentLearningPlanId)?.name || "No Path"}
                {data.learningPlans.find(lp => lp.id === currentLearningPlanId)?.dueDate && (
                  <span className="ml-3 pl-3 border-l border-zinc-300 dark:border-zinc-600 flex items-center gap-2 text-rose-600 font-semibold">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(data.learningPlans.find(lp => lp.id === currentLearningPlanId)!.dueDate!).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            
            {isSyncing && (
              <span className="flex items-center gap-2 text-[8px] text-indigo-500 animate-pulse font-bold uppercase tracking-widest">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                Syncing
              </span>
            )}
          </div>
        </header>

        <main className={`flex-1 overflow-hidden ${(effectiveTab === 'kanban' || effectiveTab === 'dashboard') ? '' : 'overflow-y-auto'}`}>
          <div className={`${(effectiveTab === 'kanban' || effectiveTab === 'dashboard') ? 'h-full' : 'max-w-[1600px] mx-auto px-8 py-10'}`}>
          {effectiveTab === "dashboard" && (
            <Dashboard 
              data={data} 
              onNavigateToQuiz={() => {
                setActiveTab("flashcards");
                setStudySubTab("quiz");
              }} 
              onNavigate={(tab) => setActiveTab(tab)}
              onAddLearningPlan={handleAddLearningPlan}
              onAddModule={handleAddModule}
              currentLearningPlanId={currentLearningPlanId}
              currentModuleId={currentModuleId}
              agentCallbacks={agentCallbacks}
            />
          )}
          {effectiveTab === "management" && (
            <Management 
              learningPlans={data.learningPlans}
              modules={data.modules}
              notes={data.notes}
              results={data.results}
              assessments={data.initialAssessments}
              onUpdateLearningPlan={handleUpdateLearningPlan}
              onDeleteLearningPlan={handleDeleteLearningPlan}
              onAddModule={handleAddModule}
              onUpdateModule={handleUpdateModule}
              onDeleteModule={handleDeleteModule}
              onAddAssessment={handleAddAssessment}
              onSelectLearningPlan={setCurrentLearningPlanId}
              onRefreshData={refreshData}
              currentLearningPlanId={currentLearningPlanId}
            />
          )}
          {effectiveTab === "notes" && (
            <NoteEditor 
              notes={data.notes} 
              onAdd={handleAddNote} 
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote} 
              search={searchQuery}
              onSearchChange={setSearchQuery}
              learningPlans={data.learningPlans}
              modules={data.modules}
              currentLearningPlanId={currentLearningPlanId}
              currentModuleId={currentModuleId}
            />
          )}
          {effectiveTab === "flashcards" && (
            <div className="space-y-8">
              <Tabs value={studySubTab} onValueChange={setStudySubTab} className="w-full">
                <div className="flex justify-center mb-12">
                  <TabsList className="bg-zinc-100/50 dark:bg-zinc-900/50 border shadow-sm rounded-full p-1.5 h-14">
                    <TabsTrigger value="flashcards" className="rounded-full px-8 h-11 data-[state=active]:bg-white data-[state=active]:shadow-md font-bold text-sm">Flashcards</TabsTrigger>
                    <TabsTrigger value="quiz" className="rounded-full px-8 h-11 data-[state=active]:bg-white data-[state=active]:shadow-md font-bold text-sm">Challenge</TabsTrigger>
                    <TabsTrigger value="book" className="rounded-full px-8 h-11 data-[state=active]:bg-white data-[state=active]:shadow-md font-bold text-sm">Learning Book</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="flashcards" className="space-y-8 outline-none focus-visible:ring-0">
                  <Flashcards
                    flashcardSets={data.flashcardSets}
                    flashcards={data.flashcards}
                    notes={data.notes}
                    currentLearningPlanId={currentLearningPlanId}
                    currentModuleId={currentModuleId}
                    onAddSet={handleAddFlashcardSet}
                    onDeleteSet={handleDeleteFlashcardSet}
                    onMarkLearned={handleMarkFlashcardLearned}
                    isGenerating={isGeneratingFlashcards}
                    onGenerate={handleGenerateFlashcards}
                    learningPlans={data.learningPlans}
                  />
                </TabsContent>

                <TabsContent value="quiz" className="space-y-8">
                  <QuizComponent 
                    notes={data.notes} 
                    quizzes={data.quizzes || []}
                    onComplete={handleAddResult} 
                    onSaveQuiz={handleSaveQuiz}
                    onAddTodo={handleAddTodo}
                    currentLearningPlanId={currentLearningPlanId}
                    currentModuleId={currentModuleId}
                    learningPlans={data.learningPlans}
                    modules={data.modules}
                  />
                </TabsContent>

                <TabsContent value="book" className="space-y-8">
                  <LearningBook 
                    notes={data.notes}
                    modules={data.modules}
                    learningPlans={data.learningPlans}
                    currentLearningPlanId={currentLearningPlanId}
                    currentModuleId={currentModuleId}
                    onExport={() => handleExportBook({ learningPlanId: currentLearningPlanId, moduleId: currentModuleId })}
                    onAskFollowUp={setFollowUpNote}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
          {effectiveTab === "kanban" && (
            <KanbanBoard 
              todos={data.todos}
              onAdd={handleAddTodo}
              onUpdate={handleUpdateTodo}
              onDelete={handleDeleteTodo}
              currentLearningPlanId={currentLearningPlanId}
              currentModuleId={currentModuleId}
              learningPlans={data.learningPlans}
              modules={data.modules}
              topicAnalysis={data.topicAnalysis}
            />
          )}
        </div>
      </main>
      </div>

      <Dialog open={!!followUpNote} onOpenChange={(open) => !open && setFollowUpNote(null)}>
        <DialogContent className="sm:max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col rounded-3xl border-none shadow-2xl">
          <DialogHeader className="p-6 border-b shrink-0 bg-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 rounded-2xl">
                <MessageSquare className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-zinc-900">
                  Follow-up: {followUpNote?.title}
                </DialogTitle>
                <DialogDescription className="text-zinc-500 mt-1">
                  Ask questions specifically about this note. AI has the full context.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-zinc-50/30">
            {followUpNote && (
              <ChatAssistant 
                data={data} 
                learningPlanId={followUpNote.learningPlanId}
                callbacks={agentCallbacks}
                embedded={true}
                initialMessage={`I have a question about the note "${followUpNote.title}".`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick AI Note Dialog */}
      <Dialog open={isQuickNoteOpen} onOpenChange={setIsQuickNoteOpen}>
        <DialogContent className="sm:max-w-2xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-indigo-600 p-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-6 h-6" />
              <DialogTitle className="text-2xl font-bold">Quick AI Note Organizer</DialogTitle>
            </div>
            <p className="text-indigo-100 text-sm">
              Paste your messy notes, lecture transcripts, or study materials. AI will structure them, split by topic, and assign modules automatically.
            </p>
          </div>
          <div className="p-8 space-y-6">
            <div className="relative">
              <Textarea 
                placeholder="Paste your notes here..." 
                className="min-h-[300px] text-lg border-zinc-200 focus-visible:ring-indigo-500 resize-none bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-2xl"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
              />
              {selectedImage && (
                <div className="absolute bottom-4 right-4 w-24 h-24 rounded-xl overflow-hidden border-2 border-white shadow-lg group">
                  <img src={selectedImage} alt="Pasted" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => {
                setIsQuickNoteOpen(false);
                setQuickInput("");
                setSelectedImage(null);
              }} className="rounded-full">Cancel</Button>
              <Button 
                onClick={handleQuickOrganize} 
                disabled={isOrganizing || (!quickInput && !selectedImage)}
                className="rounded-full px-8 bg-indigo-600 hover:bg-indigo-700 h-12 text-lg font-semibold shadow-md"
              >
                {isOrganizing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                {isOrganizing ? "Organizing..." : "Organize with AI"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster position="bottom-right" />
    </div>
  );
}



