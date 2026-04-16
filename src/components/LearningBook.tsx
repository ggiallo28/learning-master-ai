import { Note, Module, LearningPlan } from "../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronRight, Download, Sparkles, Loader2, MessageSquare, Bookmark, FolderTree } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { useState } from "react";
import { summarizeNote } from "../lib/ai";
import { toast } from "sonner";

interface LearningBookProps {
  notes: Note[];
  modules: Module[];
  learningPlans: LearningPlan[];
  currentLearningPlanId?: string;
  currentModuleId?: string;
  onExport: () => void;
  onAskFollowUp: (note: Note) => void;
}

export function LearningBook({ 
  notes, 
  modules, 
  learningPlans, 
  currentLearningPlanId, 
  currentModuleId,
  onExport,
  onAskFollowUp
}: LearningBookProps) {
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [isSummarizing, setIsSummarizing] = useState<Record<string, boolean>>({});

  const filteredNotes = notes.filter(n => 
    (!currentLearningPlanId || n.learningPlanId === currentLearningPlanId) &&
    (!currentModuleId || n.moduleId === currentModuleId)
  );

  const moduleGroups: Record<string, Note[]> = {};
  filteredNotes.forEach(note => {
    const mId = note.moduleId || "unassigned";
    if (!moduleGroups[mId]) moduleGroups[mId] = [];
    moduleGroups[mId].push(note);
  });

  const handleSummarize = async (note: Note) => {
    setIsSummarizing(prev => ({ ...prev, [note.id]: true }));
    try {
      const summary = await summarizeNote(note.title, note.content);
      setSummaries(prev => ({ ...prev, [note.id]: summary }));
      toast.success("AI Summary generated!");
    } catch (error) {
      toast.error("Failed to generate summary.");
    } finally {
      setIsSummarizing(prev => ({ ...prev, [note.id]: false }));
    }
  };

  if (filteredNotes.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="border-dashed border-2 border-zinc-200 flex flex-col items-center justify-center p-20 text-center bg-zinc-50/50 dark:bg-zinc-900/50 rounded-[3rem]">
          <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center mb-6 shadow-sm border border-zinc-100">
            <BookOpen className="w-10 h-10 text-indigo-500" />
          </div>
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Your Learning Book is Empty</h3>
          <p className="text-base text-zinc-500 max-w-sm mt-3">Add some notes or organize your study materials to see them structured here as a comprehensive guide.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Minified Header & Chapter Selection */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center shadow-inner">
            <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Learning Book</h3>
            <div className="flex items-center gap-2 mt-1">
              {currentLearningPlanId && (
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                  {learningPlans.find(lp => lp.id === currentLearningPlanId)?.name}
                </span>
              )}
              <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">Comprehensive Guide</span>
            </div>
          </div>
        </div>

        <div className="h-10 w-px bg-zinc-100 dark:bg-zinc-800 hidden md:block"></div>

        <div className="flex-1 flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          {Object.entries(moduleGroups).map(([mId, mNotes]) => {
            const module = modules.find(m => m.id === mId);
            return (
              <a 
                key={mId} 
                href={`#module-${mId}`}
                className="flex items-center gap-3 px-4 py-2 rounded-2xl border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:border-indigo-200 transition-all shrink-0 whitespace-nowrap group shadow-sm"
              >
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 group-hover:text-indigo-600 transition-colors truncate max-w-[150px]">
                  {module?.name || "Unassigned"}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-500">
                  {mNotes.length}
                </span>
              </a>
            );
          })}
        </div>

        <Button 
          onClick={onExport}
          size="lg"
          className="bg-zinc-900 hover:bg-black text-white rounded-2xl px-6 shadow-md h-12 font-bold text-sm transition-all shrink-0 gap-2"
        >
          <Download className="w-4 h-4" />
          Export Book
        </Button>
      </div>

      {/* Book Content - Minified */}
      <div className="space-y-10">
        {Object.entries(moduleGroups).map(([mId, mNotes]) => {
          const module = modules.find(m => m.id === mId);
          return (
            <section key={mId} id={`module-${mId}`} className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-6">
                <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800"></div>
                <div className="text-center">
                  <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {module?.name || "Unassigned"}
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-500 mt-1">
                    Chapter {Object.keys(moduleGroups).indexOf(mId) + 1}
                  </p>
                </div>
                <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800"></div>
              </div>

              <div className="space-y-6">
                {mNotes.map((note) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                  >
                    <Card className="border border-zinc-100 dark:border-zinc-800 shadow-md rounded-[2rem] overflow-hidden bg-white dark:bg-zinc-900">
                      <CardHeader className="p-8 pb-4 border-b border-zinc-50 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex gap-2">
                            {note.categories.map(cat => (
                              <span key={cat} className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
                                {cat}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleSummarize(note)}
                              disabled={isSummarizing[note.id]}
                              className="h-9 rounded-full gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-4"
                            >
                              {isSummarizing[note.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                              AI Summary
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => onAskFollowUp(note)}
                              className="h-9 rounded-full gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-4"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              Ask AI
                            </Button>
                          </div>
                        </div>
                        <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                          {note.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8 pt-6">
                        {summaries[note.id] && (
                          <div className="mb-6 p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 relative overflow-hidden">
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 mb-3">AI Summary</h4>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-indigo-900/80 dark:text-indigo-200/80 italic leading-relaxed text-sm">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaries[note.id]}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                        <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 leading-relaxed text-base">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
                        </div>
                      </CardContent>
                      <CardFooter className="px-8 py-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-50 dark:border-zinc-800 flex justify-between items-center">
                        <span className="text-[10px] font-medium text-zinc-400">
                          Last updated: {new Date(note.updatedAt).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Verified Content</span>
                        </div>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
