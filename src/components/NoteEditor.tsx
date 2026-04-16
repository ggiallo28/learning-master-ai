import { useState, useRef, useEffect } from "react";
import { Note, LearningPlan, Module } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Search, BookOpen, Sparkles, Image as ImageIcon, Loader2, X, Edit2, Eye, FolderTree, Layers, Info, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { organizeQuickNote, askStudyAssistant, summarizeNote } from "../lib/ai";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface NoteEditorProps {
  notes: Note[];
  onAdd: (note: Note) => void;
  onUpdate: (note: Note) => void;
  onDelete: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  learningPlans: LearningPlan[];
  modules: Module[];
  currentLearningPlanId?: string;
  currentModuleId?: string;
}

const formatMarkdown = (content: any) => {
  if (typeof content !== 'string') return JSON.stringify(content);
  return content.replace(/\\n/g, '\n');
};

function cosineSimilarity(vecA: number[] | Float32Array, vecB: number[] | Float32Array) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function NoteEditor({ 
  notes, onAdd, onUpdate, onDelete, search, onSearchChange,
  learningPlans, modules, currentLearningPlanId, currentModuleId
}: NoteEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categories, setCategories] = useState("");
  const [selectedLearningPlanId, setSelectedLearningPlanId] = useState<string | undefined>(currentLearningPlanId);
  const [selectedModuleId, setSelectedModuleId] = useState<string | undefined>(currentModuleId);
  
  const [isAdding, setIsAdding] = useState(false);
  const [quickInput, setQuickInput] = useState("");
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [organizingStep, setOrganizingStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedLearningPlanId(currentLearningPlanId);
    setSelectedModuleId(currentModuleId);
  }, [currentLearningPlanId, currentModuleId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    if (!selectedModuleId) {
      toast.error("Please select a module for this note.");
      return;
    }

    const newNote: Note = {
      id: crypto.randomUUID(),
      title,
      content,
      categories: categories.split(",").map(c => c.trim()).filter(c => c !== ""),
      learningPlanId: selectedLearningPlanId,
      moduleId: selectedModuleId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAdd(newNote);
    setTitle("");
    setContent("");
    setCategories("");
    setIsAdding(false);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;

    if (!editingNote.moduleId) {
      toast.error("Please select a module for this note.");
      return;
    }

    const updatedNote: Note = {
      ...editingNote,
      categories: typeof editingNote.categories === 'string' 
        ? (editingNote.categories as string).split(",").map(c => c.trim()).filter(c => c !== "")
        : editingNote.categories,
      updatedAt: new Date().toISOString(),
    };

    onUpdate(updatedNote);
    setEditingNote(null);
  };

  const handleSummarize = async (note: Note) => {
    setIsSummarizing(true);
    try {
      const result = await summarizeNote(note.title, note.content);
      setSummary(result);
    } catch (error) {
      toast.error("Failed to summarize note.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const [similarNotes, setSimilarNotes] = useState<Note[]>([]);
  const [isMerging, setIsMerging] = useState(false);

  useEffect(() => {
    if (viewingNote) {
      const fetchSimilar = async () => {
        const { suggestSimilarNotes } = await import("../lib/db");
        const similar = await suggestSimilarNotes(viewingNote.id);
        setSimilarNotes(similar);
      };
      fetchSimilar();
    }
  }, [viewingNote]);

  const handleMerge = async (sourceId: string, targetId: string) => {
    setIsMerging(true);
    try {
      const { mergeNotes } = await import("../lib/db");
      await mergeNotes(sourceId, targetId);
      toast.success("Notes merged successfully!");
      setViewingNote(null);
      onSearchChange(""); // Refresh
    } catch (error) {
      toast.error("Failed to merge notes.");
    } finally {
      setIsMerging(false);
    }
  };

  const handleQuickOrganize = async () => {
    if (!quickInput && !selectedImage) {
      toast.error("Please provide some text or an image.");
      return;
    }

    if (!selectedModuleId && !currentModuleId) {
      toast.error("Please select a module first. It is a mandatory field.");
      return;
    }

    setIsOrganizing(true);
    setOrganizingStep(1);
    
    // Simulate steps for better UX
    const steps = [
      "Analyzing content...",
      "Extracting key concepts...",
      "Structuring knowledge...",
      "Assigning modules...",
      "Finalizing notes..."
    ];

    const stepInterval = setInterval(() => {
      setOrganizingStep(prev => (prev < steps.length ? prev + 1 : prev));
    }, 2000);

    try {
      const availableModules = modules
        .filter(m => !selectedLearningPlanId || m.learningPlanId === selectedLearningPlanId)
        .map(m => ({ id: m.id, name: m.name, description: m.description }));
        
      const organizedNotes = await organizeQuickNote(quickInput, selectedImage?.split(",")[1], availableModules);
      
      clearInterval(stepInterval);
      setOrganizingStep(steps.length);

      for (const organized of organizedNotes) {
        // Validate that the returned moduleId is actually one of the available ones
        const isValidModule = modules.some(m => m.id === organized.moduleId);
        let aiModuleId = isValidModule ? organized.moduleId : undefined;
        
        // Fallback: try to find by name if AI returned a name instead of ID
        if (!aiModuleId && organized.moduleId) {
          const foundByName = modules.find(m => m.name.toLowerCase() === organized.moduleId?.toLowerCase());
          if (foundByName) aiModuleId = foundByName.id;
        }
        
        const targetModuleId = aiModuleId || selectedModuleId || currentModuleId;
        
        if (!targetModuleId) {
          toast.error(`Could not assign a module for "${organized.title}". Please select a module manually before using AI.`);
          continue;
        }

        const newNote: Note = {
          id: crypto.randomUUID(),
          title: organized.title,
          content: organized.organizedContent,
          categories: organized.categories,
          learningPlanId: selectedLearningPlanId,
          moduleId: targetModuleId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        onAdd(newNote);
      }

      setQuickInput("");
      setSelectedImage(null);
      setIsAdding(false);
      toast.success(`AI organized ${organizedNotes.length} note(s)!`);
    } catch (error) {
      toast.error("Failed to organize note. Please try again.");
    } finally {
      setIsOrganizing(false);
      setOrganizingStep(0);
    }
  };

  const SkeletonNote = () => (
    <div className="w-full p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 animate-pulse bg-white dark:bg-zinc-900 shadow-sm">
      <div className="flex gap-2 mb-4">
        <div className="h-4 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full"></div>
        <div className="h-4 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-full"></div>
      </div>
      <div className="h-6 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-lg mb-4"></div>
      <div className="space-y-2">
        <div className="h-3 w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-full"></div>
        <div className="h-3 w-5/6 bg-zinc-50 dark:bg-zinc-800/50 rounded-full"></div>
      </div>
      <div className="flex justify-between mt-6 pt-4 border-t border-zinc-50 dark:border-zinc-800">
        <div className="h-3 w-24 bg-zinc-50 dark:bg-zinc-800/50 rounded-full"></div>
        <div className="h-6 w-6 bg-zinc-50 dark:bg-zinc-800 rounded-full"></div>
      </div>
    </div>
  );

  const FullSkeleton = ({ isSummary }: { isSummary?: boolean }) => (
    <div className={`h-full flex flex-col ${isSummary ? 'p-0' : 'p-10'} animate-pulse`}>
      {!isSummary && (
        <div className="flex items-center justify-between mb-10">
          <div className="flex gap-3">
            <div className="h-8 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-full"></div>
            <div className="h-8 w-36 bg-zinc-200 dark:bg-zinc-800 rounded-full"></div>
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-full"></div>
            <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-full"></div>
          </div>
        </div>
      )}
      <div className={`${isSummary ? 'h-10' : 'h-16'} w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-2xl mb-8`}></div>
      {!isSummary && (
        <div className="flex gap-3 mb-12">
          <div className="h-6 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl"></div>
          <div className="h-6 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-xl"></div>
          <div className="h-6 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl"></div>
        </div>
      )}
      <div className="space-y-6 flex-1">
        <div className="h-4 w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-full"></div>
        <div className="h-4 w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-full"></div>
        <div className="h-4 w-11/12 bg-zinc-50 dark:bg-zinc-800/50 rounded-full"></div>
        <div className="h-4 w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-full"></div>
        <div className="h-4 w-4/5 bg-zinc-50 dark:bg-zinc-800/50 rounded-full"></div>
        {isSummary && <div className="h-4 w-2/3 bg-zinc-50 dark:bg-zinc-800/50 rounded-full"></div>}
      </div>
      {!isSummary && (
        <div className="mt-16 pt-8 border-t border-zinc-100 dark:border-zinc-800 flex justify-between">
          <div className="h-4 w-40 bg-zinc-50 dark:bg-zinc-800/50 rounded-full"></div>
          <div className="h-4 w-40 bg-zinc-50 dark:bg-zinc-800/50 rounded-full"></div>
        </div>
      )}
    </div>
  );

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setSelectedImage(reader.result as string);
            toast.success("Image pasted from clipboard!");
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] gap-8">
      {/* Search & Actions Header */}
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-white dark:bg-zinc-900 p-6 rounded-3xl border shadow-sm shrink-0">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <Input 
            placeholder="Search notes or ask a question..." 
            className="pl-12 border-none shadow-none focus-visible:ring-0 text-xl h-12"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant={isAdding ? "outline" : "default"} 
            size="lg"
            onClick={() => {
              setIsAdding(!isAdding);
              setEditingNote(null);
              setViewingNote(null);
            }} 
            className="rounded-full px-8 h-12 font-bold shadow-md"
          >
            {isAdding ? <X className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
            {isAdding ? "Cancel" : "New Note"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        {/* Left Pane: Note List */}
        <div className="lg:col-span-4 flex flex-col min-h-0 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="p-6 border-b bg-zinc-50/50 dark:bg-zinc-800/50">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Knowledge Base</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isOrganizing && <SkeletonNote />}
            {notes.length === 0 && !isAdding && !isOrganizing && (
              <div className="py-32 text-center opacity-40">
                <BookOpen className="w-16 h-16 mx-auto mb-6 text-zinc-300" />
                <p className="text-lg font-bold text-zinc-400">Empty Library</p>
                <p className="text-xs text-zinc-400 mt-1">Start by adding your first note.</p>
              </div>
            )}
            {notes.map((note) => {
              const isActive = (viewingNote?.id === note.id) || (editingNote?.id === note.id);
              return (
                <div
                  key={note.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setViewingNote(note);
                    setEditingNote(null);
                    setIsAdding(false);
                    setSummary(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setViewingNote(note);
                      setEditingNote(null);
                      setIsAdding(false);
                      setSummary(null);
                    }
                  }}
                  className={`w-full text-left p-5 rounded-3xl transition-all group cursor-pointer border flex flex-col ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-md'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {note.categories.slice(0, 2).map((cat, i) => (
                      <span key={i} className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-md">
                        {cat}
                      </span>
                    ))}
                  </div>
                  <h4 className={`font-bold text-base line-clamp-1 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                    {note.title}
                  </h4>
                  <div className="text-sm text-zinc-500 mt-2 leading-relaxed max-h-12 overflow-hidden flex-shrink-0 [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0 [&_strong]:font-bold [&_strong]:text-zinc-700 dark:[&_strong]:text-zinc-300">
                    <ReactMarkdown>{note.content.substring(0, 150)}</ReactMarkdown>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-2 flex-shrink-0">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(note.id);
                          if (isActive) {
                            setViewingNote(null);
                            setEditingNote(null);
                          }
                        }}
                        className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Content Area */}
        <div className="lg:col-span-8 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col shadow-sm min-h-0">
          <div className="flex-1 flex flex-col min-h-0">
            {isOrganizing ? (
              <div className="h-full flex flex-col">
                <div className="p-10 border-b bg-zinc-50/30 dark:bg-zinc-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <Sparkles className="w-7 h-7 text-indigo-600 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">AI is working...</h3>
                      <p className="text-sm text-zinc-500">
                        {[
                          "Analyzing content...",
                          "Extracting key concepts...",
                          "Structuring knowledge...",
                          "Assigning modules...",
                          "Finalizing notes..."
                        ][organizingStep - 1] || "Processing..."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                    <span className="text-sm font-bold text-indigo-500 uppercase tracking-widest">{Math.round((organizingStep / 5) * 100)}%</span>
                  </div>
                </div>
                <FullSkeleton />
              </div>
            ) : isAdding ? (
              <div className="h-full flex flex-col">
                <Tabs defaultValue="quick" className="flex-1 flex flex-col">
                  <div className="px-10 pt-10 flex items-center justify-between border-b pb-6">
                    <TabsList className="bg-zinc-100 dark:bg-zinc-800 p-1 h-12 rounded-2xl">
                      <TabsTrigger value="quick" className="gap-2 px-6 rounded-xl font-bold">Quick AI</TabsTrigger>
                      <TabsTrigger value="manual" className="px-6 rounded-xl font-bold">Manual Editor</TabsTrigger>
                    </TabsList>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">New Note</h3>
                  </div>
                  
                  <TabsContent value="quick" className="flex-1 min-h-0 m-0 overflow-hidden">
                    <div className="h-full flex flex-col p-10 gap-8">
                        <div className="flex-1 min-h-0 relative">
                          <Textarea 
                            placeholder="Type or paste your notes here... AI will structure them perfectly, split topics into separate notes, and assign them to the right modules." 
                            className="absolute inset-0 text-xl border-none focus-visible:ring-0 resize-none bg-zinc-50/50 dark:bg-zinc-950/50 p-8 rounded-[2rem] overflow-y-auto leading-relaxed"
                            value={quickInput}
                            onChange={(e) => setQuickInput(e.target.value)}
                            onPaste={handlePaste}
                          />
                        </div>
                      <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 p-6 rounded-[2rem] border border-dashed border-zinc-200 shrink-0">
                        <div className="flex items-center gap-4">
                          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                          <Button variant="outline" size="lg" onClick={() => fileInputRef.current?.click()} className="rounded-full h-12 px-6 font-bold">
                            <ImageIcon className="w-5 h-5 mr-2" />
                            {selectedImage ? "Change Image" : "Add Image"}
                          </Button>
                          {selectedImage && (
                            <div className="relative w-16 h-16 rounded-xl overflow-hidden border shadow-sm">
                              <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                              <button onClick={() => setSelectedImage(null)} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full"><X className="w-3 h-3" /></button>
                            </div>
                          )}
                        </div>
                        <Button 
                          onClick={handleQuickOrganize} 
                          size="lg"
                          disabled={isOrganizing || (!quickInput && !selectedImage)}
                          className="rounded-full px-10 h-12 bg-indigo-600 hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-100"
                        >
                          {isOrganizing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                          {isOrganizing ? "Organizing..." : "Generate Structured Note"}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="manual" className="flex-1 p-10 m-0 overflow-y-auto">
                    <form onSubmit={handleSubmit} className="h-full flex flex-col gap-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Module</label>
                          <select 
                            className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm rounded-2xl p-4 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white h-14"
                            value={selectedModuleId || ""}
                            onChange={(e) => setSelectedModuleId(e.target.value || undefined)}
                            required
                          >
                            <option value="" disabled>Select a Module</option>
                            {modules
                              .filter(m => m.learningPlanId === selectedLearningPlanId && !m.parentId)
                              .map(m => (
                                <optgroup key={m.id} label={m.name}>
                                  <option value={m.id}>{m.name} (Main)</option>
                                  {modules
                                    .filter(sub => sub.parentId === m.id)
                                    .map(sub => (
                                      <option key={sub.id} value={sub.id}>↳ {sub.name}</option>
                                    ))
                                  }
                                </optgroup>
                              ))
                            }
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Categories</label>
                          <Input 
                            placeholder="e.g. AWS, Database, Security" 
                            className="rounded-2xl bg-zinc-50 h-14 px-6"
                            value={categories}
                            onChange={(e) => setCategories(e.target.value)}
                          />
                        </div>
                      </div>
                      <Input 
                        placeholder="Note Title" 
                        className="text-4xl font-bold border-none focus-visible:ring-0 px-0 tracking-tight h-16"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                      <Textarea 
                        placeholder="Start writing your knowledge..." 
                        className="flex-1 text-xl border-none focus-visible:ring-0 resize-none bg-zinc-50/50 dark:bg-zinc-950/50 p-8 rounded-[2rem] min-h-[300px] leading-relaxed"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        required
                      />
                      <div className="flex justify-end pt-4">
                        <Button type="submit" size="lg" className="rounded-full px-16 h-14 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100">Save Note</Button>
                      </div>
                    </form>
                  </TabsContent>
                </Tabs>
              </div>
            ) : editingNote ? (
              <form onSubmit={handleUpdate} className="h-full flex flex-col p-10 gap-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Edit Mode</h2>
                  <Button variant="ghost" size="sm" onClick={() => setEditingNote(null)} className="rounded-full h-9 px-4 font-bold">Cancel</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Title</label>
                    <Input 
                      value={editingNote.title}
                      onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                      className="text-xl font-bold rounded-2xl bg-zinc-50 h-14 px-6"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Module</label>
                    <select 
                      className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm rounded-2xl p-4 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white h-14"
                      value={editingNote.moduleId || ""}
                      onChange={(e) => setEditingNote({ ...editingNote, moduleId: e.target.value || undefined })}
                      required
                    >
                      <option value="" disabled>Select a Module</option>
                      {modules.filter(m => m.learningPlanId === editingNote.learningPlanId).map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="space-y-2 flex-1 flex flex-col">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Content</label>
                  <Textarea 
                    className="flex-1 min-h-[400px] text-xl border-none focus-visible:ring-0 resize-none bg-zinc-50/50 dark:bg-zinc-950/50 p-8 rounded-[2rem] leading-relaxed"
                    value={editingNote.content}
                    onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                    required
                  />
                </div>
                <div className="flex justify-end gap-4 pt-6">
                  <Button type="submit" size="lg" className="rounded-full px-16 h-14 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100">Save Changes</Button>
                </div>
              </form>
            ) : viewingNote ? (
              <div className="h-full flex flex-col p-12 overflow-y-auto">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3">
                    {viewingNote.learningPlanId && (
                      <span className="flex items-center gap-2 text-[10px] bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full font-bold uppercase tracking-widest">
                        <FolderTree className="w-4 h-4" />
                        {learningPlans.find(lp => lp.id === viewingNote.learningPlanId)?.name}
                      </span>
                    )}
                    {viewingNote.moduleId && (
                      <span className="flex items-center gap-2 text-[10px] bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full font-bold uppercase tracking-widest">
                        <Layers className="w-4 h-4" />
                        {modules.find(m => m.id === viewingNote.moduleId)?.name}
                      </span>
                    )}
                    <span className="flex items-center gap-2 text-[10px] bg-emerald-50/50 text-emerald-600 px-4 py-1.5 rounded-full font-bold uppercase tracking-widest border border-emerald-100">
                      <ShieldCheck className="w-4 h-4" />
                      Verified Knowledge
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSummarize(viewingNote)}
                      disabled={isSummarizing}
                      className="rounded-full gap-1.5 h-9 px-4 font-bold text-xs uppercase tracking-wider"
                    >
                      {isSummarizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">AI Summary</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const { suggestSimilarNotes } = await import("../lib/db");
                        const similar = await suggestSimilarNotes(viewingNote.id);
                        setSimilarNotes(similar);
                        if (similar.length === 0) toast.info("No similar notes found.");
                        else toast.success(`Found ${similar.length} similar notes!`);
                      }}
                      className="rounded-full gap-1.5 h-9 px-4 font-bold text-xs uppercase tracking-wider"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Find Similar</span>
                    </Button>
                    <div className="flex-1 sm:flex-none"></div>
                    <Button
                      size="sm"
                      onClick={() => setEditingNote({
                        ...viewingNote,
                        categories: (Array.isArray(viewingNote.categories) ? viewingNote.categories.join(", ") : "") as any
                      })}
                      className="rounded-full gap-1.5 h-9 px-5 font-bold text-xs uppercase tracking-wider shadow-md bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                  </div>
                </div>

                <h2 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-8 leading-tight">{viewingNote.title}</h2>
                
                <div className="flex flex-wrap gap-3 mb-12">
                  {viewingNote.categories.map((cat, i) => (
                    <span key={i} className="text-[10px] font-bold uppercase tracking-[0.2em] px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl">
                      {cat}
                    </span>
                  ))}
                </div>

                {isSummarizing && (
                  <div className="mb-12 p-10 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-800">
                    <div className="flex items-center gap-3 mb-6 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-[0.2em]">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      AI Summarizing Content...
                    </div>
                    <FullSkeleton isSummary />
                  </div>
                )}

                {summary && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12 p-10 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-800 relative group shadow-sm"
                  >
                    <button onClick={() => setSummary(null)} className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-600 transition-colors"><X className="w-5 h-5" /></button>
                    <div className="flex items-center gap-3 mb-6 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-[0.2em]">
                      <Sparkles className="w-5 h-5" />
                      AI Insights & Summary
                    </div>
                    <div className="prose prose-indigo dark:prose-invert max-w-none text-base leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatMarkdown(summary)}</ReactMarkdown>
                    </div>
                  </motion.div>
                )}

                <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
                  <div className="prose prose-zinc prose-lg dark:prose-invert max-w-none pb-12 leading-relaxed text-lg">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatMarkdown(viewingNote.content)}</ReactMarkdown>
                  </div>

                  {similarNotes.length > 0 && (
                    <div className="shrink-0 pt-10 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 -mx-12 px-12 pb-10 mt-12">
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <Info className="w-4 h-4" />
                        Note Merging Suggestions
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[250px] overflow-y-auto pr-4 no-scrollbar">
                        {similarNotes.map(similar => (
                          <div key={similar.id} className="p-5 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between group shadow-sm hover:border-indigo-200 transition-all">
                            <div className="min-w-0 flex-1 mr-4">
                              <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{similar.title}</p>
                              <p className="text-xs text-zinc-500 line-clamp-1 mt-1">{similar.content.substring(0, 80)}...</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMerge(similar.id, viewingNote.id)}
                              disabled={isMerging}
                              className="rounded-full h-9 px-5 text-xs font-bold shrink-0 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
                            >
                              Merge
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="shrink-0 mt-16 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-zinc-400">
                    <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest">
                      <span>Created: {new Date(viewingNote.createdAt).toLocaleDateString()}</span>
                      <span>Last Updated: {new Date(viewingNote.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-20 opacity-30">
                <div className="w-32 h-32 rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center mb-8 shadow-inner">
                  <BookOpen className="w-16 h-16 text-zinc-300" />
                </div>
                <h3 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Select a Note</h3>
                <p className="text-base font-medium text-zinc-500 max-w-sm mt-3">Choose a note from your library to read, edit, or generate AI summaries and insights.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
