import { useState, useEffect } from "react";
import { Flashcard, FlashcardSet, Note } from "../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Plus, Trash2, BookOpen, Sparkles, Loader2, ChevronLeft, ChevronRight, RotateCcw, FolderTree, Layers, CheckCircle2, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { generateFlashcardsFromNotes } from "../lib/ai";

interface FlashcardsProps {
  flashcardSets: FlashcardSet[];
  flashcards: Flashcard[];
  notes: Note[];
  currentLearningPlanId?: string;
  currentModuleId?: string;
  onAddSet: (set: FlashcardSet, cards: Flashcard[]) => Promise<void>;
  onDeleteSet: (id: string) => Promise<void>;
  onMarkLearned?: (cardId: string, learned: boolean) => Promise<void>;
}

export function Flashcards({
  flashcardSets,
  flashcards,
  notes,
  currentLearningPlanId,
  currentModuleId,
  onAddSet,
  onDeleteSet,
  onMarkLearned,
  isGenerating,
  onGenerate,
  learningPlans = []
}: FlashcardsProps & { isGenerating: boolean, onGenerate: () => void, learningPlans?: any[] }) {
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showGlobalView, setShowGlobalView] = useState(false);
  const [showLearned, setShowLearned] = useState(false);

  const currentPlan = learningPlans.find(lp => lp.id === currentLearningPlanId);

  const filteredSets = flashcardSets.filter(s => {
    if (currentModuleId) return s.moduleId === currentModuleId;
    if (currentLearningPlanId) return s.learningPlanId === currentLearningPlanId;
    return true;
  });

  const activeSet = flashcardSets.find(s => s.id === activeSetId);

  // Get cards for current set, filter by learned status
  const allCardsInSet = flashcards.filter(c => c.setId === activeSetId);
  const activeCards = showLearned
    ? allCardsInSet.filter(c => c.learned)
    : allCardsInSet.filter(c => !c.learned);

  // Global view: all unlearned cards across all sets (unified deck to study)
  const globalCards = flashcards.filter(c => !c.learned);

  // Per-set view: filter by learned status based on toggle
  const globalCardsForView = showGlobalView && !activeSetId ? globalCards : flashcards.filter(c => showLearned ? c.learned : !c.learned);

  const handleGenerate = async () => {
    onGenerate();
  };

  const getActiveCardsList = () => {
    if (showGlobalView && !activeSetId) {
      return globalCards;
    }
    return activeCards;
  };

  const cardsToUse = getActiveCardsList();

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cardsToUse.length);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + cardsToUse.length) % cardsToUse.length);
    }, 150);
  };

  const SkeletonCard = () => (
    <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col gap-4 animate-pulse h-[240px]">
      <div className="h-6 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded-lg"></div>
      <div className="h-4 w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"></div>
      <div className="h-4 w-2/3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg"></div>
      <div className="mt-auto flex justify-between items-center">
        <div className="h-8 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-full"></div>
        <div className="h-8 w-8 bg-zinc-100 dark:bg-zinc-800 rounded-full"></div>
      </div>
    </div>
  );

  const SkeletonFlashcard = () => (
    <div className="space-y-8 max-w-3xl mx-auto pt-4 animate-pulse">
      <div className="flex items-center justify-between px-4">
        <div className="h-9 w-32 bg-zinc-100 dark:bg-zinc-800 rounded-full"></div>
        <div className="flex items-center gap-4">
          <div className="h-2 w-32 bg-zinc-100 dark:bg-zinc-800 rounded-full"></div>
          <div className="h-4 w-12 bg-zinc-100 dark:bg-zinc-800 rounded"></div>
        </div>
      </div>
      <div className="h-[400px] w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[3rem] shadow-sm flex flex-col items-center justify-center p-12">
        <div className="h-8 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-6"></div>
        <div className="h-4 w-3/4 bg-zinc-50 dark:bg-zinc-800/50 rounded-full mb-2"></div>
        <div className="h-4 w-2/3 bg-zinc-50 dark:bg-zinc-800/50 rounded-full"></div>
      </div>
      <div className="flex items-center justify-center gap-6">
        <div className="h-14 w-14 rounded-full bg-zinc-100 dark:bg-zinc-800"></div>
        <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800"></div>
        <div className="h-14 w-14 rounded-full bg-zinc-100 dark:bg-zinc-800"></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-[1.5rem] flex items-center justify-center shadow-sm">
              <BookOpen className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Study Flashcards</h3>
              <div className="flex items-center gap-3 mt-2">
                {currentPlan && (
                  <span className="text-[11px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-1.5 rounded-full font-bold uppercase tracking-[0.15em]">
                    {currentPlan.name}
                  </span>
                )}
                <span className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-4 py-1.5 rounded-full font-bold uppercase tracking-[0.15em]">AI Generated</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGlobalView(!showGlobalView)}
              className="rounded-full h-10 px-4 text-xs font-bold gap-2"
            >
              <Globe className="w-4 h-4" />
              {showGlobalView ? "My Sets" : "Global View"}
            </Button>
            {!showGlobalView && activeSetId && (
              <Button
                variant={showLearned ? "default" : "outline"}
                size="sm"
                onClick={() => setShowLearned(!showLearned)}
                className="rounded-full h-10 px-4 text-xs font-bold gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {showLearned ? "Learned" : "Learning"}
              </Button>
            )}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              size="lg"
              className="rounded-full h-14 px-10 text-base font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none gap-3"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Generate New Set
            </Button>
          </div>
        </div>
      </div>

      {showGlobalView && !activeSetId && globalCards.length > 0 ? (
        <div className="space-y-8 max-w-3xl mx-auto pt-4">
          <div className="flex items-center justify-between px-4">
            <Button variant="ghost" size="sm" onClick={() => setShowGlobalView(false)} className="gap-2 text-zinc-500 hover:text-indigo-600 rounded-full h-9 px-4 text-xs font-bold">
              <ChevronLeft className="w-4 h-4" /> Back to Sets
            </Button>
            <div className="flex items-center gap-4">
              <div className="h-2 w-32 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                <motion.div
                  className="h-full bg-indigo-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentIndex + 1) / globalCards.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{currentIndex + 1} / {globalCards.length}</span>
            </div>
          </div>

          <div className="perspective-1000 h-[400px] w-full relative cursor-pointer group" onClick={() => setIsFlipped(!isFlipped)}>
            <motion.div
              className="w-full h-full relative preserve-3d"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 15, mass: 1 }}
            >
              {/* Front */}
              <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 text-center shadow-xl border-zinc-100 dark:border-zinc-800 rounded-[3rem] bg-white dark:bg-zinc-900 group-hover:shadow-2xl transition-shadow">
                <div className="absolute top-8 left-8 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Question</span>
                </div>
                <div className="w-full max-h-[240px] overflow-y-auto px-4 scrollbar-thin">
                  <h3 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 leading-tight break-words">{globalCards[currentIndex].front}</h3>
                </div>
                <div className="absolute bottom-8 text-xs text-zinc-400 font-bold flex items-center gap-2 bg-zinc-50 px-4 py-2 rounded-full">
                  <RotateCcw className="w-3 h-3" /> Click to Flip
                </div>
              </Card>

              {/* Back */}
              <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 text-center shadow-xl border-emerald-100 dark:border-emerald-900/30 rounded-[3rem] bg-emerald-50/50 dark:bg-emerald-900/10" style={{ transform: 'rotateY(180deg)' }}>
                <div className="absolute top-8 left-8 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Answer</span>
                </div>
                <div className="w-full max-h-[240px] overflow-y-auto px-4 scrollbar-thin">
                  <div className="text-xl text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium break-words">{globalCards[currentIndex].back}</div>
                </div>
                <div className="absolute bottom-8 text-xs text-emerald-600/60 font-bold flex items-center gap-2 bg-emerald-100/50 px-4 py-2 rounded-full">
                  <RotateCcw className="w-3 h-3" /> Flip back
                </div>
              </Card>
            </motion.div>
          </div>

          <div className="flex items-center justify-center gap-6">
            <Button variant="outline" size="icon" onClick={prevCard} className="h-14 w-14 rounded-full shadow-md border-zinc-100 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all hover:scale-110">
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => { setIsFlipped(false); setCurrentIndex(0); }} className="h-12 w-12 rounded-full shadow-md border-zinc-100 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
              <RotateCcw className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={async () => {
                if (onMarkLearned && globalCards[currentIndex]) {
                  const cardId = globalCards[currentIndex].id;
                  const wasLearned = globalCards[currentIndex].learned;
                  await onMarkLearned(cardId, !wasLearned);
                  toast.success(wasLearned ? "Unmarked as learned" : "Marked as learned! ✓");
                  // Reset index to 0 after marking, let component re-render with updated list
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }
              }}
              className={`h-14 w-14 rounded-full shadow-md transition-all hover:scale-110 ${
                globalCards[currentIndex]?.learned
                  ? "bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white"
                  : "border-zinc-100 dark:border-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              }`}
            >
              <CheckCircle2 className="w-6 h-6" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextCard} className="h-14 w-14 rounded-full shadow-md border-zinc-100 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all hover:scale-110">
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>

          <div className="px-4 pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 text-center">From: <span className="font-bold text-zinc-700 dark:text-zinc-300">{flashcardSets.find(s => s.id === globalCards[currentIndex].setId)?.title}</span></p>
          </div>
        </div>
      ) : showGlobalView && !activeSetId ? (
        <div className="text-center py-12 opacity-40">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-zinc-400" />
          <p className="text-zinc-500 font-medium">All cards mastered! 🎉</p>
        </div>
      ) : isGenerating && !activeSetId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : activeSetId && activeCards.length > 0 ? (
        <div className="space-y-8 max-w-3xl mx-auto pt-4">
          <div className="flex items-center justify-between px-4">
            <Button variant="ghost" size="sm" onClick={() => setActiveSetId(null)} className="gap-2 text-zinc-500 hover:text-indigo-600 rounded-full h-9 px-4 text-xs font-bold">
              <ChevronLeft className="w-4 h-4" /> Back to Sets
            </Button>
            <div className="flex items-center gap-4">
              <div className="h-2 w-32 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                <motion.div 
                  className="h-full bg-indigo-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentIndex + 1) / activeCards.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{currentIndex + 1} / {activeCards.length}</span>
            </div>
          </div>

          <div className="perspective-1000 h-[400px] w-full relative cursor-pointer group" onClick={() => setIsFlipped(!isFlipped)}>
            <motion.div
              className="w-full h-full relative preserve-3d"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 15, mass: 1 }}
            >
              {/* Front */}
              <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 text-center shadow-xl border-zinc-100 dark:border-zinc-800 rounded-[3rem] bg-white dark:bg-zinc-900 group-hover:shadow-2xl transition-shadow">
                <div className="absolute top-8 left-8 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Question</span>
                </div>
                <div className="w-full max-h-[240px] overflow-y-auto px-4 scrollbar-thin">
                  <h3 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 leading-tight break-words">{activeCards[currentIndex].front}</h3>
                </div>
                <div className="absolute bottom-8 text-xs text-zinc-400 font-bold flex items-center gap-2 bg-zinc-50 px-4 py-2 rounded-full">
                  <RotateCcw className="w-3 h-3" /> Click to Flip
                </div>
              </Card>

              {/* Back */}
              <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 text-center shadow-xl border-emerald-100 dark:border-emerald-900/30 rounded-[3rem] bg-emerald-50/50 dark:bg-emerald-900/10" style={{ transform: 'rotateY(180deg)' }}>
                <div className="absolute top-8 left-8 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Answer</span>
                </div>
                <div className="w-full max-h-[240px] overflow-y-auto px-4 scrollbar-thin">
                  <div className="text-xl text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium break-words">{activeCards[currentIndex].back}</div>
                </div>
                <div className="absolute bottom-8 text-xs text-emerald-600/60 font-bold flex items-center gap-2 bg-emerald-100/50 px-4 py-2 rounded-full">
                  <RotateCcw className="w-3 h-3" /> Flip back
                </div>
              </Card>
            </motion.div>
          </div>

          <div className="flex items-center justify-center gap-6">
            <Button variant="outline" size="icon" onClick={prevCard} className="h-14 w-14 rounded-full shadow-md border-zinc-100 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all hover:scale-110">
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => { setIsFlipped(false); setCurrentIndex(0); }} className="h-12 w-12 rounded-full shadow-md border-zinc-100 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
              <RotateCcw className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={async () => {
                if (onMarkLearned && activeCards[currentIndex]) {
                  const cardId = activeCards[currentIndex].id;
                  const wasLearned = activeCards[currentIndex].learned;
                  await onMarkLearned(cardId, !wasLearned);
                  toast.success(wasLearned ? "Unmarked as learned" : "Marked as learned! ✓");
                  // Reset index to 0 after marking, let component re-render with updated filtered list
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }
              }}
              className={`h-14 w-14 rounded-full shadow-md transition-all hover:scale-110 ${
                activeCards[currentIndex]?.learned
                  ? "bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white"
                  : "border-zinc-100 dark:border-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              }`}
            >
              <CheckCircle2 className="w-6 h-6" />
            </Button>
            <Button variant="outline" size="icon" onClick={nextCard} className="h-14 w-14 rounded-full shadow-md border-zinc-100 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all hover:scale-110">
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>
        </div>
      ) : filteredSets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredSets.map((set) => {
            const cardCount = flashcards.filter(c => c.setId === set.id).length;
            return (
              <motion.div
                key={set.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -5 }}
                className="group cursor-pointer"
                onClick={() => { setActiveSetId(set.id); setCurrentIndex(0); setIsFlipped(false); }}
              >
                <Card className="h-[240px] p-8 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm group-hover:shadow-xl group-hover:border-indigo-100 transition-all flex flex-col">
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 mb-3 group-hover:text-indigo-600 transition-colors">{set.title}</h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-3 leading-relaxed">{set.description || "No description provided."}</p>
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-full">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-600">{cardCount} Cards</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-10 w-10 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      onClick={(e) => { e.stopPropagation(); onDeleteSet(set.id); }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-100 dark:border-zinc-800 shadow-sm">
          <div className="w-24 h-24 rounded-[2rem] bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-8 shadow-inner">
            <BookOpen className="w-10 h-10 text-indigo-300" />
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Ready to test your knowledge?</h3>
          <p className="text-base font-medium text-zinc-500 max-w-md mt-3 px-6">
            Generate a new flashcard set from your notes to start your study session.
          </p>
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating}
            className="mt-8 rounded-full h-12 px-10 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generate First Set"}
          </Button>
        </div>
      )}
    </div>
  );
}

