import { useState } from "react";
import { Flashcard, FlashcardSet, Note } from "../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Plus, Trash2, BookOpen, Sparkles, Loader2, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { generateFlashcardsFromNotes } from "../lib/gemini";

interface FlashcardsProps {
  flashcardSets: FlashcardSet[];
  flashcards: Flashcard[];
  notes: Note[];
  currentLearningPlanId?: string;
  currentModuleId?: string;
  onAddSet: (set: FlashcardSet, cards: Flashcard[]) => Promise<void>;
  onDeleteSet: (id: string) => Promise<void>;
}

export function Flashcards({
  flashcardSets,
  flashcards,
  notes,
  currentLearningPlanId,
  currentModuleId,
  onAddSet,
  onDeleteSet
}: FlashcardsProps) {
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const filteredSets = flashcardSets.filter(s => {
    if (currentModuleId) return s.moduleId === currentModuleId;
    if (currentLearningPlanId) return s.learningPlanId === currentLearningPlanId;
    return true;
  });

  const activeSet = flashcardSets.find(s => s.id === activeSetId);
  const activeCards = flashcards.filter(c => c.setId === activeSetId);

  const handleGenerate = async () => {
    const relevantNotes = notes.filter(n => {
      if (currentModuleId) return n.moduleId === currentModuleId;
      if (currentLearningPlanId) return n.learningPlanId === currentLearningPlanId;
      return true;
    });

    if (relevantNotes.length === 0) {
      toast.error("No notes found to generate flashcards from.");
      return;
    }

    setIsGenerating(true);
    try {
      const generated = await generateFlashcardsFromNotes(relevantNotes, flashcards);
      const setId = crypto.randomUUID();
      const newSet: FlashcardSet = {
        id: setId,
        title: `AI Generated: ${relevantNotes[0]?.title || "Study Set"}`,
        description: `Generated from ${relevantNotes.length} notes`,
        learningPlanId: currentLearningPlanId,
        moduleId: currentModuleId,
        createdAt: new Date().toISOString()
      };

      const newCards: Flashcard[] = generated.map((g: any) => ({
        id: crypto.randomUUID(),
        setId,
        front: g.front,
        back: g.back,
        createdAt: new Date().toISOString()
      }));

      await onAddSet(newSet, newCards);
      setActiveSetId(setId);
      toast.success(`Generated ${newCards.length} flashcards!`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate flashcards.");
    } finally {
      setIsGenerating(false);
    }
  };

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % activeCards.length);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + activeCards.length) % activeCards.length);
    }, 150);
  };

  if (activeSetId && activeCards.length > 0) {
    const currentCard = activeCards[currentIndex];
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setActiveSetId(null)} className="gap-2">
            <ChevronLeft className="w-4 h-4" /> Back to Sets
          </Button>
          <div className="text-sm font-medium text-zinc-500">
            Card {currentIndex + 1} of {activeCards.length}
          </div>
        </div>

        <div className="perspective-1000 h-[400px] w-full max-w-2xl mx-auto relative cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
          <motion.div
            className="w-full h-full relative preserve-3d transition-all duration-500"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            {/* Front */}
            <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 text-center shadow-xl border-2 border-indigo-100 bg-white">
              <span className="absolute top-4 left-4 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Question</span>
              <h3 className="text-2xl font-bold text-zinc-800">{currentCard.front}</h3>
              <p className="mt-8 text-sm text-zinc-400 font-medium">Click to flip</p>
            </Card>

            {/* Back */}
            <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-12 text-center shadow-xl border-2 border-emerald-100 bg-emerald-50/30" style={{ transform: 'rotateY(180deg)' }}>
              <span className="absolute top-4 left-4 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Answer</span>
              <div className="text-xl text-zinc-800 leading-relaxed">{currentCard.back}</div>
              <p className="mt-8 text-sm text-zinc-400 font-medium">Click to flip back</p>
            </Card>
          </motion.div>
        </div>

        <div className="flex items-center justify-center gap-6">
          <Button variant="outline" size="icon" onClick={prevCard} className="h-12 w-12 rounded-full shadow-md">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => { setIsFlipped(false); setCurrentIndex(0); }} className="h-12 w-12 rounded-full shadow-md">
            <RotateCcw className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextCard} className="h-12 w-12 rounded-full shadow-md">
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Flashcards</h2>
          <p className="text-zinc-500 mt-1">Master concepts through active recall and spaced repetition.</p>
        </div>
        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6 shadow-lg shadow-indigo-100 transition-all gap-2"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          AI Generate Set
        </Button>
      </div>

      {filteredSets.length === 0 ? (
        <Card className="border-dashed border-2 flex flex-col items-center justify-center p-16 text-center bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6">
            <BookOpen className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">No Flashcard Sets Yet</h3>
          <p className="text-zinc-500 max-w-sm mt-2">Use the AI generator to create a set from your notes, or add one manually.</p>
          <Button onClick={handleGenerate} disabled={isGenerating} variant="outline" className="mt-8 rounded-full px-8">
            Generate First Set
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSets.map((set) => {
            const cardCount = flashcards.filter(c => c.setId === set.id).length;
            return (
              <motion.div
                key={set.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
              >
                <Card className="group cursor-pointer hover:shadow-xl transition-all border-zinc-100 overflow-hidden h-full flex flex-col">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => { e.stopPropagation(); onDeleteSet(set.id); }}
                        className="text-zinc-300 hover:text-red-500 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <CardTitle className="mt-4 group-hover:text-indigo-600 transition-colors">{set.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{set.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                      <Layers className="w-3 h-3" />
                      {cardCount} Cards
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button 
                      onClick={() => { setActiveSetId(set.id); setCurrentIndex(0); setIsFlipped(false); }}
                      className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl"
                    >
                      Study Now
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Layers({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m2.6 12.08 8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83" />
      <path d="m2.6 17.08 8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83" />
    </svg>
  );
}
