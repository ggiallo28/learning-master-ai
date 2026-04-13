/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Note, QuizResult, AppData, LearningPlan, Module, Quiz, Flashcard, FlashcardSet } from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NoteEditor } from "./components/NoteEditor";
import { Dashboard } from "./components/Dashboard";
import { Quiz as QuizComponent } from "./components/Quiz";
import { Flashcards } from "./components/Flashcards";
import { BookOpen, LayoutDashboard, BrainCircuit, Settings, Database, RefreshCw, FolderTree, GraduationCap, Download, Sparkles, Plus, Loader2, CreditCard } from "lucide-react";
import { Toaster } from "sonner";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  initDB, getNotes, saveNote, deleteNote, getResults, saveResult, clearAndSeed, 
  searchNotes, updateNote, vectorSearchNotes,
  getLearningPlans, saveLearningPlan, deleteLearningPlan,
  getModules, saveModule, deleteModule, getQuizzes, saveQuiz,
  getConversations, saveConversation, getTopicAnalysis, saveTopicAnalysis,
  getInitialAssessments, saveInitialAssessment,
  getFlashcardSets, saveFlashcardSet, deleteFlashcardSet, getFlashcards, saveFlashcard
} from "./lib/db";
import { generateEmbedding, extractTopicsAndAnalyze } from "./lib/gemini";
import { organizeQuickNote } from "./lib/noteAgent";
import { ChatAssistant } from "./components/ChatAssistant";
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
    flashcards: []
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Context state
  const [currentLearningPlanId, setCurrentLearningPlanId] = useState<string | undefined>(undefined);
  const [currentModuleId, setCurrentModuleId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const setup = async () => {
      try {
        // 1. Fetch initial data from server-side local file
        const res = await fetch("/api/data");
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
      const [notes, results, learningPlans, modules, quizzes, conversations, topicAnalysis, initialAssessments, flashcardSets] = await Promise.all([
        getNotes(currentLearningPlanId, currentModuleId), 
        getResults(),
        getLearningPlans(),
        getModules(),
        getQuizzes(currentLearningPlanId, currentModuleId),
        getConversations(currentLearningPlanId),
        getTopicAnalysis(currentLearningPlanId),
        getInitialAssessments(),
        getFlashcardSets(currentLearningPlanId, currentModuleId)
      ]);

      const flashcards: Flashcard[] = [];
      for (const set of flashcardSets) {
        const cards = await getFlashcards(set.id);
        flashcards.push(...cards);
      }

      const newData = { notes, results, learningPlans, modules, quizzes, conversations, topicAnalysis, initialAssessments, flashcardSets, flashcards };
      setData(newData);
      return newData;
    } catch (error) {
      toast.error("Failed to load data from DuckDB");
      return { 
        notes: [], results: [], learningPlans: [], modules: [], quizzes: [], 
        conversations: [], topicAnalysis: [], initialAssessments: [],
        flashcardSets: [], flashcards: []
      };
    }
  };

  const syncWithServer = async (currentData: AppData) => {
    setIsSyncing(true);
    try {
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentData),
      });
    } catch (error) {
      console.error("Sync failed", error);
      toast.error("Failed to persist data to local file");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddNote = async (note: Note) => {
    console.log("Adding note:", note);
    try {
      const embedding = await generateEmbedding(`${note.title} ${note.content} ${note.categories.join(' ')}`);
      console.log("Generated embedding:", embedding.length);
      await saveNote({ ...note, embedding, learningPlanId: currentLearningPlanId, moduleId: currentModuleId });
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

  const handleExportBook = async (args: { learningPlanId?: string; moduleId?: string }) => {
    const notesToExport = await getNotes(args.learningPlanId, args.moduleId);
    if (notesToExport.length === 0) {
      toast.error("No notes found to export.");
      return "";
    }

    let markdown = `# CertMaster AI - Study Book\n\n`;
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
    a.download = `CertMaster_StudyBook_${new Date().toISOString().split('T')[0]}.md`;
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
      const newNote: Note = {
        id: crypto.randomUUID(),
        title: noteArgs.title,
        content: noteArgs.content,
        categories: noteArgs.categories,
        learningPlanId: noteArgs.learningPlanId || currentLearningPlanId,
        moduleId: noteArgs.moduleId || currentModuleId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await handleAddNote(newNote);
    },
    onNavigate: (args: any) => {
      if (args.view) setActiveTab(args.view === "learning" ? "notes" : args.view); // map learning to notes for now or specific view
      if (args.learningPlanId) setCurrentLearningPlanId(args.learningPlanId);
      if (args.moduleId) setCurrentModuleId(args.moduleId);
      toast.info(`Agent navigated to ${args.view}`);
    },
    onExportBook: handleExportBook,
    onSaveConversation: handleSaveConversation
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
  const [isOrganizing, setIsOrganizing] = useState(false);

  const handleQuickOrganize = async () => {
    if (!quickInput) return;
    setIsOrganizing(true);
    try {
      const availableModules = data.modules.map(m => ({ id: m.id, name: m.name, description: m.description }));
      const organizedNotes = await organizeQuickNote(quickInput, undefined, availableModules);
      
      for (const organized of organizedNotes) {
        const newNote: Note = {
          id: crypto.randomUUID(),
          title: organized.title,
          content: organized.organizedContent,
          rawContent: quickInput, // Preserve the raw input
          categories: organized.categories,
          learningPlanId: currentLearningPlanId,
          moduleId: organized.moduleId || currentModuleId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await handleAddNote(newNote);
      }

      setQuickInput("");
      setIsQuickNoteOpen(false);
      toast.success(`AI organized ${organizedNotes.length} note(s)!`);
    } catch (error) {
      toast.error("Failed to organize note.");
    } finally {
      setIsOrganizing(false);
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
    <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="flex flex-col gap-6 mb-8">
          {/* Top Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                <BrainCircuit className="w-8 h-8 text-white" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  Learning Master AI
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-mono uppercase tracking-widest">In-Process DB</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-full border shadow-sm">
              <Button 
                variant={activeTab === "dashboard" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setActiveTab("dashboard")}
                className="gap-2 rounded-full h-9 px-4"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>
              <Button 
                variant={activeTab === "notes" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setActiveTab("notes")}
                className="gap-2 rounded-full h-9 px-4"
              >
                <BookOpen className="w-4 h-4" />
                Notes
              </Button>
              <Button 
                variant={activeTab === "quiz" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setActiveTab("quiz")}
                className="gap-2 rounded-full h-9 px-4"
              >
                <BrainCircuit className="w-4 h-4" />
                Challenge
              </Button>
              <Button 
                variant={activeTab === "flashcards" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setActiveTab("flashcards")}
                className="gap-2 rounded-full h-9 px-4"
              >
                <GraduationCap className="w-4 h-4" />
                Study & Review
              </Button>
              <Button 
                variant={activeTab === "management" ? "default" : "ghost"} 
                size="sm"
                onClick={() => setActiveTab("management")}
                className="gap-2 rounded-full h-9 px-4"
              >
                <Settings className="w-4 h-4" />
                Manage
              </Button>
            </div>
          </div>

          {/* Sub Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setIsQuickNoteOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6 shadow-md hover:shadow-lg transition-all gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Generative AI
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentLearningPlanId(undefined)}
                className="text-zinc-500 hover:text-indigo-600 gap-2 h-10 rounded-full border-zinc-200 bg-white dark:bg-zinc-900 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Switch Path
              </Button>
              <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full text-sm font-medium border">
                <FolderTree className="w-4 h-4 text-indigo-500" />
                {data.learningPlans.find(lp => lp.id === currentLearningPlanId)?.name || "No Path Selected"}
              </div>
            </div>
            
            {isSyncing && (
              <span className="flex items-center gap-2 text-[10px] text-indigo-500 animate-pulse font-bold uppercase tracking-widest">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Syncing with DuckDB
              </span>
            )}
          </div>
        </header>

        <main className="pb-20">
          {effectiveTab === "dashboard" && (
            <Dashboard 
              data={data} 
              onNavigateToQuiz={() => setActiveTab("quiz")} 
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
          {effectiveTab === "quiz" && (
            <QuizComponent 
              notes={data.notes} 
              quizzes={data.quizzes || []}
              onComplete={handleAddResult} 
              onSaveQuiz={handleSaveQuiz}
              currentLearningPlanId={currentLearningPlanId}
              currentModuleId={currentModuleId}
              learningPlans={data.learningPlans}
              modules={data.modules}
            />
          )}
          {effectiveTab === "flashcards" && (
            <Tabs defaultValue="flashcards" className="w-full">
              <div className="flex justify-center mb-8">
                <TabsList className="bg-white dark:bg-zinc-900 border shadow-sm rounded-full p-1">
                  <TabsTrigger value="flashcards" className="rounded-full px-8">Flashcards</TabsTrigger>
                  <TabsTrigger value="book" className="rounded-full px-8">Learning Book</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="flashcards">
                <Flashcards 
                  flashcardSets={data.flashcardSets}
                  flashcards={data.flashcards}
                  notes={data.notes}
                  currentLearningPlanId={currentLearningPlanId}
                  currentModuleId={currentModuleId}
                  onAddSet={handleAddFlashcardSet}
                  onDeleteSet={handleDeleteFlashcardSet}
                />
              </TabsContent>

              <TabsContent value="book">
                <div className="max-w-5xl mx-auto space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight">Learning Book</h2>
                      <p className="text-zinc-500 mt-1">A comprehensive guide generated from your structured notes.</p>
                    </div>
                    <Button onClick={() => handleExportBook({ learningPlanId: currentLearningPlanId, moduleId: currentModuleId })} className="gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700">
                      <Download className="w-4 h-4" />
                      Export PDF/MD
                    </Button>
                  </div>
                  
                  <div className="space-y-12">
                    {data.notes.length > 0 ? (
                      (() => {
                        // Group notes by module
                        const moduleGroups: { [key: string]: Note[] } = {};
                        data.notes.forEach(note => {
                          const mId = note.moduleId || "unassigned";
                          if (!moduleGroups[mId]) moduleGroups[mId] = [];
                          moduleGroups[mId].push(note);
                        });

                        return Object.entries(moduleGroups).map(([mId, mNotes]) => {
                          const module = data.modules.find(m => m.id === mId);
                          return (
                            <section key={mId} className="space-y-6">
                              <div className="flex items-center gap-4">
                                <div className="h-px flex-1 bg-zinc-200"></div>
                                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-500">
                                  {module?.name || "Unassigned Notes"}
                                </h3>
                                <div className="h-px flex-1 bg-zinc-200"></div>
                              </div>
                              
                              <div className="grid grid-cols-1 gap-8">
                                {mNotes.map((note) => (
                                  <Card key={note.id} className="border-none shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-zinc-900">
                                    <CardHeader className="p-8 pb-4">
                                      <div className="flex items-center justify-between mb-4">
                                        <div className="flex gap-2">
                                          {note.categories.map(cat => (
                                            <span key={cat} className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-500">{cat}</span>
                                          ))}
                                        </div>
                                        <span className="text-xs text-zinc-400 font-medium">{new Date(note.updatedAt).toLocaleDateString()}</span>
                                      </div>
                                      <CardTitle className="text-3xl font-bold tracking-tight">{note.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-8 pt-0">
                                      <div className="prose prose-zinc dark:prose-invert max-w-none prose-headings:text-indigo-600 prose-a:text-indigo-500">
                                        <ReactMarkdown>{typeof note.content === 'string' ? note.content : JSON.stringify(note.content)}</ReactMarkdown>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </section>
                          );
                        });
                      })()
                    ) : (
                      <Card className="border-dashed border-2 flex flex-col items-center justify-center p-20 text-center bg-zinc-50/50">
                        <BookOpen className="w-12 h-12 text-zinc-300 mb-4" />
                        <h3 className="text-xl font-bold">Your book is empty</h3>
                        <p className="text-zinc-500 max-w-sm mt-2">Add notes to modules to see them organized here as a comprehensive learning guide.</p>
                      </Card>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>

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
            <Textarea 
              placeholder="Paste your notes here..." 
              className="min-h-[300px] text-lg border-zinc-200 focus-visible:ring-indigo-500 resize-none bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-2xl"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsQuickNoteOpen(false)} className="rounded-full">Cancel</Button>
              <Button 
                onClick={handleQuickOrganize} 
                disabled={isOrganizing || !quickInput}
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



