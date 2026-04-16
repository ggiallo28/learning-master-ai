import { useState } from "react";
import { LearningPlan, Module, InitialAssessment, AppData, Note, QuizResult } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Trash2, FolderTree, Layers, Star, CheckCircle2, ChevronRight, Settings, BookOpen, Sparkles, Loader2, Download, Upload, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { generateModulesFromAI } from "../lib/ai";
import { getFullDump, importDump } from "../lib/db";
import JSZip from "jszip";

interface ManagementProps {
  learningPlans: LearningPlan[];
  modules: Module[];
  notes: Note[];
  results: QuizResult[];
  assessments: InitialAssessment[];
  onUpdateLearningPlan: (lp: LearningPlan) => void;
  onDeleteLearningPlan: (id: string) => void;
  onAddModule: (module: Module) => void;
  onUpdateModule: (module: Module) => void;
  onDeleteModule: (id: string) => void;
  onAddAssessment: (assessment: InitialAssessment) => void;
  onSelectLearningPlan: (id: string) => void;
  onRefreshData: () => Promise<any>;
  currentLearningPlanId?: string;
}

interface ModuleNode extends Module {
  children: ModuleNode[];
}

export function Management({
  learningPlans,
  modules,
  notes,
  results,
  assessments,
  onUpdateLearningPlan,
  onDeleteLearningPlan,
  onAddModule,
  onUpdateModule,
  onDeleteModule,
  onAddAssessment,
  onSelectLearningPlan,
  onRefreshData,
  currentLearningPlanId
}: ManagementProps) {
  const [newModule, setNewModule] = useState({ learningPlanId: currentLearningPlanId || "", parentId: "", name: "", description: "" });
  const [assessmentTarget, setAssessmentTarget] = useState<{ id: string, type: 'learningPlan' | 'module', name: string } | null>(null);
  const [rating, setRating] = useState(0);
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [isEditingLP, setIsEditingLP] = useState(false);
  const [editLPData, setEditLPData] = useState({ name: "", description: "", dueDate: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState<string | null>(null);

  const currentLP = learningPlans.find(lp => lp.id === currentLearningPlanId);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const dump = await getFullDump();
      const zip = new JSZip();
      zip.file("learning_master_backup.json", JSON.stringify(dump, (key, value) => 
        typeof value === 'bigint' ? Number(value) : value
      , 2));
      const content = await zip.generateAsync({ type: "blob" });
      
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `learning_master_backup_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("Backup exported successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export backup.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const jsonFile = zip.file("learning_master_backup.json");
      if (!jsonFile) {
        throw new Error("Invalid backup file: learning_master_backup.json not found.");
      }
      
      const jsonStr = await jsonFile.async("string");
      const data = JSON.parse(jsonStr) as AppData;
      
      await importDump(data);
      await onRefreshData();
      
      toast.success("Backup restored successfully!");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to restore backup.");
    } finally {
      setIsImporting(false);
      e.target.value = ""; // Reset input
    }
  };

  const handleAIGenerateModules = async () => {
    if (!aiDescription || !currentLearningPlanId) return;
    setIsAIGenerating(true);
    try {
      const generated = await generateModulesFromAI(aiDescription);
      for (const mod of generated) {
        const moduleId = crypto.randomUUID();
        onAddModule({
          id: moduleId,
          learningPlanId: currentLearningPlanId,
          name: mod.name,
          description: mod.description,
          createdAt: new Date().toISOString()
        });

        if (mod.submodules) {
          for (const sub of mod.submodules) {
            onAddModule({
              id: crypto.randomUUID(),
              learningPlanId: currentLearningPlanId,
              parentId: moduleId,
              name: sub.name,
              description: sub.description,
              createdAt: new Date().toISOString()
            });
          }
        }
      }
      toast.success(`Generated ${generated.length} modules with AI!`);
      setIsAIDialogOpen(false);
      setAiDescription("");
    } catch (error) {
      toast.error("Failed to generate modules.");
    } finally {
      setIsAIGenerating(false);
    }
  };

  const handleEditLP = () => {
    if (!currentLP || !editLPData.name) return;
    onUpdateLearningPlan({
      ...currentLP,
      name: editLPData.name,
      description: editLPData.description,
      dueDate: editLPData.dueDate || undefined
    });
    setIsEditingLP(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetId: string, type: 'plan' | 'module') => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      toast.error("Please upload a PDF file.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to extract PDF: ${response.status} ${errorText}`);
      }

      const { text } = await response.json();
      
      const attachment = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        content: text,
        createdAt: new Date().toISOString()
      };

      if (type === 'plan' && currentLP) {
        onUpdateLearningPlan({
          ...currentLP,
          attachments: [...(currentLP.attachments || []), attachment]
        });
      } else if (type === 'module') {
        const module = modules.find(m => m.id === targetId);
        if (module) {
          onUpdateModule({
            ...module,
            attachments: [...(module.attachments || []), attachment]
          });
        }
      }
      toast.success(`Attached ${file.name} successfully!`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to process PDF.");
    } finally {
      setIsUploading(false);
    }
  };
  const buildModuleTree = (allModules: Module[], lpId?: string): ModuleNode[] => {
    const filtered = allModules.filter(m => !lpId || m.learningPlanId === lpId);
    const map = new Map<string, ModuleNode>();
    const roots: ModuleNode[] = [];

    filtered.forEach(m => {
      map.set(m.id, { ...m, children: [] });
    });

    filtered.forEach(m => {
      const node = map.get(m.id)!;
      if (m.parentId && map.has(m.parentId)) {
        map.get(m.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const moduleTree = buildModuleTree(modules, currentLearningPlanId);

  const handleAddModule = () => {
    if (!newModule.name || !newModule.learningPlanId) return;

    if (editingModuleId) {
      const existingModule = modules.find(m => m.id === editingModuleId);
      if (existingModule) {
        onUpdateModule({
          ...existingModule,
          name: newModule.name,
          description: newModule.description
        });
        toast.success("Module updated!");
      }
    } else {
      const id = crypto.randomUUID();
      onAddModule({
        id,
        learningPlanId: newModule.learningPlanId,
        parentId: newModule.parentId || undefined,
        name: newModule.name,
        description: newModule.description,
        createdAt: new Date().toISOString()
      });
      setAssessmentTarget({ id, type: 'module', name: newModule.name });
      toast.success("Module created!");
    }

    setNewModule({ learningPlanId: currentLearningPlanId || "", parentId: "", name: "", description: "" });
    setIsAddingModule(false);
    setEditingModuleId(null);
  };

  const openAddModule = (parentId?: string) => {
    setEditingModuleId(null);
    setNewModule({
      learningPlanId: currentLearningPlanId || "",
      parentId: parentId || "",
      name: "",
      description: ""
    });
    setIsAddingModule(true);
  };

  const openEditModule = (module: Module) => {
    setEditingModuleId(module.id);
    setNewModule({
      learningPlanId: module.learningPlanId,
      parentId: module.parentId || "",
      name: module.name,
      description: module.description
    });
    setIsAddingModule(true);
  };

  const submitAssessment = () => {
    if (!assessmentTarget || rating === 0) return;
    onAddAssessment({
      id: crypto.randomUUID(),
      targetId: assessmentTarget.id,
      targetType: assessmentTarget.type,
      rating,
      timestamp: new Date().toISOString()
    });
    setAssessmentTarget(null);
    setRating(0);
    toast.success("Assessment saved! This will help tailor your learning experience.");
  };

  const [isDeletingLP, setIsDeletingLP] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const handleDeleteLP = () => {
    if (!currentLP || deleteConfirmName !== currentLP.name) {
      toast.error("Name does not match.");
      return;
    }
    onDeleteLearningPlan(currentLP.id);
    setIsDeletingLP(false);
    setDeleteConfirmName("");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="bg-white dark:bg-zinc-900 p-10 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-10">
        <div className="flex items-center gap-8">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-[1.5rem] flex items-center justify-center shadow-inner shrink-0">
            <FolderTree className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
              {currentLP ? currentLP.name : "Learning Architecture"}
            </h2>
            <div className="flex items-center gap-6 mt-3">
              {currentLP?.dueDate && (
                <span className="flex items-center gap-2.5 text-sm text-amber-600 dark:text-amber-400 font-bold uppercase tracking-[0.1em]">
                  <Calendar className="w-5 h-5" />
                  Due: {new Date(currentLP.dueDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              <span className="flex items-center gap-2.5 text-sm text-zinc-400 font-bold uppercase tracking-[0.1em]">
                <Settings className="w-5 h-5" />
                Management
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {currentLP && (
            <>
              <Button 
                variant="outline"
                size="lg"
                onClick={() => setIsAIDialogOpen(true)}
                className="rounded-full h-14 px-10 font-bold text-base border-indigo-100 text-indigo-600 hover:bg-indigo-50 gap-3 shadow-sm"
              >
                <Sparkles className="w-6 h-6" />
                AI Generator
              </Button>
              <Button 
                size="lg"
                onClick={() => openAddModule()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full h-14 px-10 font-bold text-base shadow-lg shadow-indigo-100 dark:shadow-none gap-3"
              >
                <Plus className="w-6 h-6" />
                New Module
              </Button>
              <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 p-2 rounded-full border">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setEditLPData({ 
                      name: currentLP.name, 
                      description: currentLP.description,
                      dueDate: currentLP.dueDate || "" 
                    });
                    setIsEditingLP(true);
                  }}
                  className="h-11 w-11 text-zinc-400 hover:text-indigo-600 rounded-full"
                >
                  <Settings className="w-6 h-6" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsDeletingLP(true)}
                  className="h-11 w-11 text-zinc-400 hover:text-red-500 rounded-full"
                >
                  <Trash2 className="w-6 h-6" />
                </Button>
              </div>
            </>
          )}
          <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 p-2 rounded-full border">
            <Button variant="ghost" size="sm" onClick={handleExport} className="gap-2 rounded-full h-10 px-5 text-sm font-bold" disabled={isExporting}>
              <Download className="w-5 h-5" />
              Export
            </Button>
            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
            <div className="relative">
              <input 
                type="file" 
                accept=".zip" 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={handleImport}
                disabled={isImporting}
              />
              <Button variant="ghost" size="sm" className="gap-2 rounded-full h-10 px-5 text-sm font-bold" disabled={isImporting}>
                <Upload className="w-5 h-5" />
                Import
              </Button>
            </div>
          </div>
        </div>
      </div>

      {currentLP && (
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <div className="relative">
            <input 
              type="file" 
              accept=".pdf" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              onChange={(e) => handleFileUpload(e, currentLP.id, 'plan')}
              disabled={isUploading}
            />
            <Button variant="outline" size="sm" className="gap-2 rounded-full border-dashed bg-white dark:bg-zinc-900" disabled={isUploading}>
              <Plus className="w-3.5 h-3.5" />
              {isUploading ? "Processing..." : "Attach PDF to Plan"}
            </Button>
          </div>
          {currentLP.attachments?.map(att => (
            <div key={att.id} className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-zinc-900 rounded-full text-[10px] font-bold uppercase tracking-wider text-zinc-500 border shadow-sm">
              <BookOpen className="w-3 h-3 text-indigo-500" />
              {att.name}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {moduleTree.length === 0 ? (
          <Card className="border-dashed border-2 flex flex-col items-center justify-center p-20 text-center bg-zinc-50/50 dark:bg-zinc-900/50 rounded-[3rem]">
            <div className="w-20 h-20 bg-white dark:bg-zinc-800 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-zinc-100 dark:border-zinc-700">
              <Layers className="w-10 h-10 text-zinc-300" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">No Modules Yet</h3>
            <p className="text-base font-medium text-zinc-500 max-w-sm mt-3">Start building your learning structure by adding your first module or using the AI generator.</p>
            <Button 
              onClick={() => openAddModule()} 
              className="mt-8 rounded-full h-12 px-10 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100" 
              disabled={!currentLearningPlanId}
            >
              Add First Module
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {moduleTree.map((node) => (
              <ModuleTreeItem 
                key={node.id} 
                node={node} 
                notes={notes}
                results={results}
                onAddSubmodule={openAddModule} 
                onEdit={openEditModule}
                onDelete={() => setModuleToDelete(node.id)}
                onFileUpload={handleFileUpload}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Learning Plan Dialog */}
      <Dialog open={isEditingLP} onOpenChange={setIsEditingLP}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Learning Plan</DialogTitle>
            <CardDescription>Update the title and description of your study path.</CardDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input 
                value={editLPData.name}
                onChange={(e) => setEditLPData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea 
                value={editLPData.description}
                onChange={(e) => setEditLPData(prev => ({ ...prev, description: e.target.value }))}
                className="h-32"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Overall Due Date</label>
              <Input 
                type="date"
                value={editLPData.dueDate}
                onChange={(e) => setEditLPData(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditingLP(false)}>Cancel</Button>
            <Button onClick={handleEditLP} className="bg-indigo-600">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Learning Plan Dialog */}
      <Dialog open={isDeletingLP} onOpenChange={setIsDeletingLP}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Learning Path</DialogTitle>
            <CardDescription>
              This action is irreversible. All modules, notes, and progress associated with this path will be permanently deleted.
            </CardDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm">Please type <span className="font-bold">"{currentLP?.name}"</span> to confirm.</p>
            <Input 
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Type the name here..."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeletingLP(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteLP} 
              disabled={deleteConfirmName !== currentLP?.name}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Module Dialog */}
      <Dialog open={!!moduleToDelete} onOpenChange={(open) => !open && setModuleToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Module</DialogTitle>
            <CardDescription>
              Are you sure you want to delete this module? This will also delete all submodules and associated notes.
            </CardDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModuleToDelete(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (moduleToDelete) {
                  onDeleteModule(moduleToDelete);
                  setModuleToDelete(null);
                  toast.success("Module deleted.");
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Module Generator Dialog */}
      <Dialog open={isAIDialogOpen} onOpenChange={setIsAIDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              AI Module Generator
            </DialogTitle>
            <CardDescription>
              Describe the subject or certification you're studying, and Learning Master AI will generate a structured curriculum for you.
            </CardDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isAIGenerating ? (
              <div className="space-y-6 animate-pulse">
                <div className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-indigo-600">AI is architecting your path...</p>
                    <p className="text-xs text-indigo-400">This may take a minute for complex topics.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="p-4 border rounded-xl space-y-2">
                      <div className="h-4 w-1/3 bg-zinc-100 dark:bg-zinc-800 rounded"></div>
                      <div className="h-3 w-full bg-zinc-50 dark:bg-zinc-900 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">What are you studying?</label>
                <Textarea 
                  placeholder="e.g., AWS Certified Solutions Architect Associate, covering compute, storage, networking, and security..." 
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  className="h-32"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAIDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleAIGenerateModules} 
              disabled={!aiDescription || isAIGenerating} 
              className="bg-indigo-600 gap-2"
            >
              {isAIGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Structure
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Module Dialog */}
      <Dialog open={isAddingModule} onOpenChange={(open) => {
        setIsAddingModule(open);
        if (!open) setEditingModuleId(null);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingModuleId ? "Edit Module" : (newModule.parentId ? "Add Submodule" : "Add New Module")}
            </DialogTitle>
            <CardDescription>
              {editingModuleId 
                ? "Update the details of this learning block."
                : (newModule.parentId 
                    ? `Adding a sub-topic to ${modules.find(m => m.id === newModule.parentId)?.name}`
                    : "Create a new top-level study module.")}
            </CardDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Module Name</label>
              <Input 
                placeholder="e.g., Fundamentals, Advanced Patterns" 
                value={newModule.name}
                onChange={(e) => setNewModule(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea 
                placeholder="Briefly describe what this module covers..." 
                value={newModule.description}
                onChange={(e) => setNewModule(prev => ({ ...prev, description: e.target.value }))}
                className="h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setIsAddingModule(false); setEditingModuleId(null); }}>Cancel</Button>
            <Button onClick={handleAddModule} disabled={!newModule.name} className="bg-indigo-600">
              {editingModuleId ? "Save Changes" : "Create Module"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Initial Assessment Dialog */}
      <Dialog open={!!assessmentTarget} onOpenChange={() => setAssessmentTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Initial Knowledge Assessment</DialogTitle>
            <CardDescription>
              How much do you already know about <span className="font-bold text-indigo-600">{assessmentTarget?.name}</span>?
              This helps the AI tailor quizzes and study suggestions.
            </CardDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6 space-y-4">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`p-2 transition-transform hover:scale-110 ${rating >= star ? "text-yellow-400" : "text-zinc-200"}`}
                >
                  <Star className="w-10 h-10 fill-current" />
                </button>
              ))}
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-indigo-600">{rating}/5</span>
              <p className="text-sm text-zinc-500">
                {rating === 1 && "Complete beginner"}
                {rating === 2 && "Some basic concepts"}
                {rating === 3 && "Intermediate understanding"}
                {rating === 4 && "Strong knowledge"}
                {rating === 5 && "Expert / Professional"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitAssessment} disabled={rating === 0} className="w-full bg-indigo-600">
              Save Assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModuleTreeItem({ 
  node, 
  notes,
  results,
  onAddSubmodule, 
  onEdit,
  onDelete, 
  onFileUpload,
  level = 0 
}: { 
  node: ModuleNode, 
  notes: Note[],
  results: QuizResult[],
  onAddSubmodule: (id: string) => void, 
  onEdit: (module: Module) => void,
  onDelete: (id: string) => void,
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, targetId: string, type: 'plan' | 'module') => void,
  level?: number
}) {
  const moduleNotes = notes.filter(n => n.moduleId === node.id);
  const moduleResults = results.filter(r => r.moduleId === node.id);
  
  // Scoring coverage: based on number of notes (simple heuristic for now)
  // 0 notes = 0%, 1 note = 30%, 2 notes = 60%, 3+ notes = 100%
  const coverageScore = Math.min(100, moduleNotes.length * 33);
  
  // Scoring performance: average of quiz results
  const performanceScore = moduleResults.length > 0 
    ? Math.round((moduleResults.reduce((acc, r) => acc + (r.score / r.totalQuestions), 0) / moduleResults.length) * 100)
    : null;

  return (
    <div className="space-y-2">
      <Card className={`border shadow-sm overflow-hidden rounded-[2rem] ${level === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-50/50 dark:bg-zinc-900/50'}`}>
        <div className="p-8 flex items-start justify-between gap-8">
          <div className="flex items-start gap-6 flex-1">
            <div className={`mt-1 p-3 rounded-2xl ${level === 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-zinc-100 text-zinc-500'}`}>
              {level === 0 ? <Layers className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <h4 className="font-bold text-xl text-zinc-900 dark:text-zinc-100">{node.name}</h4>
              </div>
              <p className="text-lg text-zinc-500 line-clamp-2 mt-2 leading-relaxed">{node.description}</p>
              
              <div className="flex flex-wrap items-center gap-4 mt-6">
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".pdf" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={(e) => onFileUpload(e, node.id, 'module')}
                  />
                  <Button variant="ghost" size="sm" className="h-10 text-sm font-bold text-zinc-400 hover:text-indigo-600 gap-2 px-5 rounded-full hover:bg-indigo-50">
                    <Plus className="w-5 h-5" />
                    Attach PDF
                  </Button>
                </div>
                {node.attachments?.map(att => (
                  <div key={att.id} className="flex items-center gap-2.5 px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-bold text-zinc-500 border shadow-sm">
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    {att.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-8 shrink-0 pt-1">
            <div className="flex items-center gap-6 border-r pr-8 border-zinc-100">
              <div className="flex flex-col items-start gap-2">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Coverage</span>
                <div className="h-2 w-24 bg-zinc-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${coverageScore > 70 ? 'bg-emerald-500' : coverageScore > 30 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${coverageScore}%` }}
                  />
                </div>
              </div>
              {performanceScore !== null && (
                <div className="flex flex-col items-start gap-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Performance</span>
                  <span className={`text-sm font-black leading-none ${performanceScore > 80 ? 'text-emerald-600' : performanceScore > 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {performanceScore}%
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onEdit(node)}
                className="text-zinc-400 hover:text-indigo-600 h-10 w-10 rounded-full"
                title="Edit Module"
              >
                <Settings className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="lg" 
                onClick={() => onAddSubmodule(node.id)}
                className="text-zinc-500 hover:text-indigo-600 h-10 px-4 font-bold text-xs uppercase tracking-widest rounded-full"
              >
                <Plus className="w-4 h-4 mr-2" /> Submodule
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onDelete(node.id)}
                className="text-zinc-400 hover:text-red-500 h-10 w-10 rounded-full"
                title="Delete Module"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
      
      {node.children.length > 0 && (
        <div className="ml-8 border-l-2 border-zinc-100 dark:border-zinc-800 pl-4 space-y-2">
          {node.children.map((child) => (
            <ModuleTreeItem 
              key={child.id} 
              node={child} 
              notes={notes}
              results={results}
              onAddSubmodule={onAddSubmodule} 
              onEdit={onEdit}
              onDelete={onDelete}
              onFileUpload={onFileUpload}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
