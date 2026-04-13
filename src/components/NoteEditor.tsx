import { useState, useRef, useEffect } from "react";
import { Note, LearningPlan, Module } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Search, BookOpen, Sparkles, Image as ImageIcon, Loader2, X, Edit2, Eye, Send, FolderTree, Layers } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { organizeQuickNote, askStudyAssistant } from "../lib/noteAgent";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

  const handleQuickOrganize = async () => {
    if (!quickInput && !selectedImage) {
      toast.error("Please provide some text or an image.");
      return;
    }

    setIsOrganizing(true);
    try {
      const availableModules = modules.map(m => ({ id: m.id, name: m.name, description: m.description }));
      const organizedNotes = await organizeQuickNote(quickInput, selectedImage?.split(",")[1], availableModules);
      
      for (const organized of organizedNotes) {
        if (!organized.moduleId && !currentModuleId) {
          toast.error("AI could not assign a module. Please assign one manually.");
          continue;
        }

        const newNote: Note = {
          id: crypto.randomUUID(),
          title: organized.title,
          content: organized.organizedContent,
          categories: organized.categories,
          learningPlanId: selectedLearningPlanId,
          moduleId: organized.moduleId || selectedModuleId,
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
    }
  };

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
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Minimal Header & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input 
            placeholder="Search notes or ask a question..." 
            className="pl-10 border-none shadow-none focus-visible:ring-0 text-lg"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={isAdding ? "outline" : "default"} 
            onClick={() => setIsAdding(!isAdding)} 
            className="rounded-full px-6"
          >
            {isAdding ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {isAdding ? "Cancel" : "New Note"}
          </Button>
        </div>
      </div>


      {/* Editor Section */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="border-none shadow-xl overflow-hidden bg-white dark:bg-zinc-900">
              <Tabs defaultValue="quick" className="w-full">
                <div className="px-8 pt-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <TabsList className="bg-zinc-100 dark:bg-zinc-800">
                    <TabsTrigger value="quick" className="gap-2">Quick AI</TabsTrigger>
                    <TabsTrigger value="manual">Manual Editor</TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="quick" className="p-8 pt-6">
                  <div className="space-y-6">
                    <Textarea 
                      placeholder="Type or paste your notes here... AI will structure them perfectly, split topics into separate notes, and assign them to the right modules." 
                      className="min-h-[300px] text-lg border-none focus-visible:ring-0 resize-none bg-zinc-50/50 dark:bg-zinc-950/50 p-6 rounded-2xl"
                      value={quickInput}
                      onChange={(e) => setQuickInput(e.target.value)}
                      onPaste={handlePaste}
                    />
                    <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-dashed">
                      <div className="flex items-center gap-4">
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="rounded-full">
                          <ImageIcon className="w-4 h-4 mr-2" />
                          {selectedImage ? "Change Image" : "Add Image"}
                        </Button>
                        {selectedImage && (
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden border">
                            <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                            <button onClick={() => setSelectedImage(null)} className="absolute top-0 right-0 bg-black/50 text-white p-0.5"><X className="w-3 h-3" /></button>
                          </div>
                        )}
                      </div>
                      <Button 
                        onClick={handleQuickOrganize} 
                        disabled={isOrganizing || (!quickInput && !selectedImage)}
                        className="rounded-full px-8 bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isOrganizing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                        {isOrganizing ? "Organizing..." : "Generate Structured Note"}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="manual" className="p-8 pt-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Module / Submodule</label>
                        <select 
                          className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm rounded-lg p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                          value={selectedModuleId || ""}
                          onChange={(e) => setSelectedModuleId(e.target.value || undefined)}
                          disabled={!selectedLearningPlanId}
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
                    </div>
                    <Input 
                      placeholder="Note Title" 
                      className="text-2xl font-bold border-none focus-visible:ring-0 px-0"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                    <Input 
                      placeholder="Categories (e.g. AWS, Database, Security)" 
                      className="border-none focus-visible:ring-0 px-0 text-zinc-500"
                      value={categories}
                      onChange={(e) => setCategories(e.target.value)}
                    />
                    <Textarea 
                      placeholder="Start writing..." 
                      className="min-h-[400px] text-lg border-none focus-visible:ring-0 resize-none bg-zinc-50/50 dark:bg-zinc-950/50 p-6 rounded-2xl"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      required
                    />
                    <div className="flex justify-end">
                      <Button type="submit" className="rounded-full px-8">Save Note</Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes Feed */}
      <div className="grid grid-cols-1 gap-6">
        {notes.map((note) => {
          const lp = learningPlans.find(l => l.id === note.learningPlanId);
          const m = modules.find(mod => mod.id === note.moduleId);
          
          return (
            <motion.div 
              layout
              key={note.id} 
              className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    {lp && (
                      <span className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                        <FolderTree className="w-3 h-3" />
                        {lp.name}
                      </span>
                    )}
                    {m && (
                      <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                        <Layers className="w-3 h-3" />
                        {m.name}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 transition-colors">
                    {note.title}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {note.categories.map((cat, i) => (
                      <span key={i} className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => setViewingNote(note)} className="rounded-full h-9 w-9">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditingNote({ ...note, categories: note.categories.join(", ") as any })} className="rounded-full h-9 w-9">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(note.id)} className="rounded-full h-9 w-9 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none line-clamp-3 text-zinc-600 dark:text-zinc-400">
                <ReactMarkdown>{typeof note.content === 'string' ? note.content : JSON.stringify(note.content)}</ReactMarkdown>
              </div>
            </motion.div>
          );
        })}
        {notes.length === 0 && !isAdding && (
          <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
            <BookOpen className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Your knowledge base is empty</h3>
            <p className="text-zinc-500 max-w-sm mx-auto mt-2">Start taking notes to build your personal study assistant and challenge your knowledge.</p>
          </div>
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={!!viewingNote} onOpenChange={() => setViewingNote(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-none">
          <div className="p-10">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                {viewingNote?.learningPlanId && (
                  <span className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-bold">
                    <FolderTree className="w-3 h-3" />
                    {learningPlans.find(lp => lp.id === viewingNote.learningPlanId)?.name}
                  </span>
                )}
                {viewingNote?.moduleId && (
                  <span className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full font-bold">
                    <Layers className="w-3 h-3" />
                    {modules.find(m => m.id === viewingNote.moduleId)?.name}
                  </span>
                )}
              </div>
              <h2 className="text-4xl font-bold mb-4">{viewingNote?.title}</h2>
              <div className="flex flex-wrap gap-2">
                {viewingNote?.categories.map((cat, i) => (
                  <span key={i} className="text-xs font-semibold uppercase tracking-wider px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <ReactMarkdown>{typeof viewingNote?.content === 'string' ? viewingNote.content : JSON.stringify(viewingNote?.content || "")}</ReactMarkdown>
            </div>
            <div className="mt-10 pt-6 border-t flex justify-between items-center">
              <span className="text-sm text-zinc-400">Created on {viewingNote && new Date(viewingNote.createdAt).toLocaleDateString()}</span>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setViewingNote(null)} className="rounded-full">Close</Button>
                <Button onClick={() => {
                  setEditingNote({ ...viewingNote!, categories: viewingNote!.categories.join(", ") as any });
                  setViewingNote(null);
                }} className="rounded-full px-8">Edit Note</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingNote} onOpenChange={() => setEditingNote(null)}>
        <DialogContent className="max-w-4xl rounded-3xl p-0 border-none">
          <form onSubmit={handleUpdate} className="p-10 space-y-6">
            <h2 className="text-2xl font-bold">Edit Note</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Title</label>
                <Input 
                  value={editingNote?.title || ""}
                  onChange={(e) => setEditingNote(prev => prev ? { ...prev, title: e.target.value } : null)}
                  className="text-xl font-bold border-zinc-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Categories</label>
                <Input 
                  value={editingNote?.categories as any || ""}
                  onChange={(e) => setEditingNote(prev => prev ? { ...prev, categories: e.target.value as any } : null)}
                  className="border-zinc-200"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Module</label>
                <select 
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm rounded-lg p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                  value={editingNote?.moduleId || ""}
                  onChange={(e) => setEditingNote(prev => prev ? { ...prev, moduleId: e.target.value || undefined } : null)}
                  disabled={!editingNote?.learningPlanId}
                  required
                >
                  <option value="" disabled>Select a Module</option>
                  {modules.filter(m => m.learningPlanId === editingNote?.learningPlanId).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Content</label>
              <Textarea 
                className="min-h-[400px] text-lg border-zinc-200 resize-none p-6 rounded-2xl"
                value={editingNote?.content || ""}
                onChange={(e) => setEditingNote(prev => prev ? { ...prev, content: e.target.value } : null)}
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setEditingNote(null)} className="rounded-full">Cancel</Button>
              <Button type="submit" className="rounded-full px-8 bg-indigo-600 hover:bg-indigo-700">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
