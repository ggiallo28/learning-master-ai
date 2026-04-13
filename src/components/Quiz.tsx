import { useState } from "react";
import { Note, QuizQuestion, QuizResult, LearningPlan, Module, Quiz as QuizType } from "../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { generateQuizFromNotes } from "../lib/gemini";
import { Brain, CheckCircle2, XCircle, ArrowRight, Loader2, RefreshCw, BookOpen, FolderTree, Layers, Save, History } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface QuizProps {
  notes: Note[];
  quizzes: QuizType[];
  onComplete: (result: QuizResult) => void;
  onSaveQuiz: (quiz: QuizType) => void;
  currentLearningPlanId?: string;
  currentModuleId?: string;
  learningPlans: LearningPlan[];
  modules: Module[];
}

export function Quiz({ notes, quizzes, onComplete, onSaveQuiz, currentLearningPlanId, currentModuleId, learningPlans, modules }: QuizProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [mistakes, setMistakes] = useState<QuizResult["mistakes"]>([]);
  const [quizFinished, setQuizFinished] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [isMistakeFollowUp, setIsMistakeFollowUp] = useState(false);
  const [showSavedQuizzes, setShowSavedQuizzes] = useState(false);

  const startQuiz = async (mode: "standard" | "study" = "standard") => {
    if (notes.length < 1) {
      toast.error("You need at least one note to generate a quiz.");
      return;
    }
    setIsGenerating(true);
    setStudyMode(mode === "study");
    
    try {
      let targetNotes = notes;
      if (mode === "study") {
        targetNotes = [notes[currentNoteIndex]];
      }

      const lp = learningPlans.find(l => l.id === currentLearningPlanId);
      const m = modules.find(mod => mod.id === currentModuleId);

      // Collect attachments from LP and Module
      const lpAttachments = lp?.attachments || [];
      const moduleAttachments = m?.attachments || [];
      const allAttachments = [...lpAttachments, ...moduleAttachments];

      const generatedQuestions = await generateQuizFromNotes(targetNotes, allAttachments, undefined, lp?.name, m?.name);
      if (generatedQuestions.length > 0) {
        setQuestions(generatedQuestions);
        setCurrentIndex(0);
        setScore(0);
        setMistakes([]);
        setQuizFinished(false);
        setIsAnswered(false);
        setSelectedOptionIndex(null);
        setIsMistakeFollowUp(false);
      } else {
        toast.error("Failed to generate questions. Try adding more detailed notes.");
      }
    } catch (error) {
      toast.error("AI generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const startMistakeFollowUp = async () => {
    setIsGenerating(true);
    try {
      const targetNotes = studyMode ? [notes[currentNoteIndex]] : notes;
      const mistakeContext = mistakes.map(m => `Q: ${m.question}, Correct: ${m.correctAnswer}`).join("; ");
      
      const lp = learningPlans.find(l => l.id === currentLearningPlanId);
      const m = modules.find(mod => mod.id === currentModuleId);

      // Collect attachments from LP and Module
      const lpAttachments = lp?.attachments || [];
      const moduleAttachments = m?.attachments || [];
      const allAttachments = [...lpAttachments, ...moduleAttachments];

      const generatedQuestions = await generateQuizFromNotes(targetNotes, allAttachments, mistakeContext, lp?.name, m?.name);
      
      if (generatedQuestions.length > 0) {
        setQuestions(generatedQuestions);
        setCurrentIndex(0);
        setScore(0);
        setMistakes([]);
        setQuizFinished(false);
        setIsAnswered(false);
        setSelectedOptionIndex(null);
        setIsMistakeFollowUp(true);
      } else {
        toast.error("Could not generate follow-up questions.");
      }
    } catch (error) {
      toast.error("Follow-up generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const nextNote = () => {
    if (currentNoteIndex < notes.length - 1) {
      setCurrentNoteIndex(currentNoteIndex + 1);
      setQuizFinished(false);
      setQuestions([]);
    } else {
      toast.success("Study Session Complete! You've navigated through all notes.");
      setStudyMode(false);
      setCurrentNoteIndex(0);
      setQuizFinished(false);
      setQuestions([]);
    }
  };

  const handleAnswer = (optionIndex: number) => {
    if (isAnswered) return;
    setSelectedOptionIndex(optionIndex);
    setIsAnswered(true);

    const currentQuestion = questions[currentIndex];
    if (optionIndex === currentQuestion.correctIndex) {
      setScore(s => s + 1);
    } else {
      setMistakes(m => [...m, {
        question: currentQuestion.question,
        userAnswer: currentQuestion.options[optionIndex],
        correctAnswer: currentQuestion.options[currentQuestion.correctIndex],
        explanation: currentQuestion.explanation
      }]);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsAnswered(false);
      setSelectedOptionIndex(null);
    } else {
      const result: QuizResult = {
        id: crypto.randomUUID(),
        quizId: crypto.randomUUID(),
        learningPlanId: currentLearningPlanId,
        moduleId: currentModuleId,
        score,
        totalQuestions: questions.length,
        date: new Date().toISOString(),
        mistakes
      };
      onComplete(result);
      setQuizFinished(true);
    }
  };

  const handleSaveCurrentQuiz = () => {
    if (questions.length === 0) return;
    const newQuiz: QuizType = {
      id: crypto.randomUUID(),
      title: `Quiz on ${new Date().toLocaleDateString()}`,
      description: `Generated quiz with ${questions.length} questions`,
      learningPlanId: currentLearningPlanId,
      moduleId: currentModuleId,
      questions,
      createdAt: new Date().toISOString()
    };
    onSaveQuiz(newQuiz);
    toast.success("Quiz saved to your collection!");
  };

  const loadSavedQuiz = (quiz: QuizType) => {
    setQuestions(quiz.questions);
    setCurrentIndex(0);
    setScore(0);
    setMistakes([]);
    setQuizFinished(false);
    setIsAnswered(false);
    setSelectedOptionIndex(null);
    setShowSavedQuizzes(false);
    setStudyMode(false);
  };

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-zinc-600 font-medium text-center">
          {isMistakeFollowUp ? "Reinforcing your weak points..." : "Gemini is crafting your personalized challenge..."}
          <br />
          <span className="text-xs text-zinc-400">
            Context: {currentLearningPlanId ? learningPlans.find(lp => lp.id === currentLearningPlanId)?.name : "All Topics"}
            {currentModuleId ? ` > ${modules.find(m => m.id === currentModuleId)?.name}` : ""}
          </span>
        </p>
      </div>
    );
  }

  if (questions.length === 0 || quizFinished) {
    return (
      <div className="space-y-6">
        {showSavedQuizzes ? (
          <Card className="max-w-2xl mx-auto border-indigo-100 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  Saved Quizzes
                </CardTitle>
                <CardDescription>Re-take your previously generated quizzes.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowSavedQuizzes(false)}>Back</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {quizzes.length > 0 ? (
                quizzes.map(q => (
                  <div key={q.id} className="p-4 rounded-lg border hover:border-indigo-300 transition-colors cursor-pointer group" onClick={() => loadSavedQuiz(q)}>
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold group-hover:text-indigo-600">{q.title}</h4>
                      <span className="text-[10px] text-zinc-400">{new Date(q.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{q.questions.length} Questions</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-zinc-400">
                  <p>No saved quizzes yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="max-w-2xl mx-auto border-indigo-100 shadow-xl overflow-hidden">
            <div className="h-2 bg-indigo-600 w-full" />
            <CardHeader className="text-center pt-8">
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-indigo-600" />
              </div>
              <CardTitle className="text-2xl">
                {quizFinished ? "Quiz Completed!" : "Ready for a Challenge?"}
              </CardTitle>
              <CardDescription>
                {quizFinished 
                  ? `You scored ${score} out of ${questions.length}`
                  : studyMode 
                    ? `Study Session: Note ${currentNoteIndex + 1} of ${notes.length}`
                    : "We'll generate questions based on your study notes to test your knowledge."}
              </CardDescription>
              <div className="flex items-center justify-center gap-2 mt-2">
                {currentLearningPlanId && (
                  <span className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                    <FolderTree className="w-3 h-3" />
                    {learningPlans.find(lp => lp.id === currentLearningPlanId)?.name}
                  </span>
                )}
                {currentModuleId && (
                  <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                    <Layers className="w-3 h-3" />
                    {modules.find(m => m.id === currentModuleId)?.name}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {quizFinished && (
                <div className="flex justify-center">
                  <Button variant="outline" size="sm" onClick={handleSaveCurrentQuiz} className="gap-2 text-indigo-600 border-indigo-200">
                    <Save className="w-4 h-4" />
                    Save this Quiz
                  </Button>
                </div>
              )}
              {quizFinished && mistakes.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-zinc-900 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      Review Mistakes
                    </h4>
                    <Button variant="outline" size="sm" onClick={startMistakeFollowUp} className="text-indigo-600 border-indigo-200">
                      Try Follow-up Quiz
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {mistakes.map((m, i) => (
                      <div key={i} className="p-4 rounded-lg bg-red-50 border border-red-100 space-y-2">
                        <p className="font-medium text-sm text-red-900">{m.question}</p>
                        <p className="text-xs text-red-700">
                          <span className="font-bold">Your answer:</span> {m.userAnswer}
                        </p>
                        <p className="text-xs text-green-700">
                          <span className="font-bold">Correct answer:</span> {m.correctAnswer}
                        </p>
                        <p className="text-xs text-zinc-600 italic mt-2">{m.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {quizFinished && mistakes.length === 0 && studyMode && (
                <div className="p-4 rounded-lg bg-green-50 border border-green-100 text-center">
                  <p className="text-green-800 font-medium">Perfect score! You've mastered this note.</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pb-8">
              {!quizFinished ? (
                <div className="flex flex-col gap-4 w-full">
                  <div className="flex flex-col md:flex-row gap-3 w-full justify-center">
                    <Button onClick={() => startQuiz("standard")} size="lg" className="gap-2 px-8">
                      Standard Quiz
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <Button onClick={() => startQuiz("study")} variant="outline" size="lg" className="gap-2 px-8 border-indigo-200 text-indigo-600">
                      Start Study Session
                      <BookOpen className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex justify-center">
                    <Button variant="ghost" size="sm" onClick={() => setShowSavedQuizzes(true)} className="gap-2 text-zinc-500">
                      <History className="w-4 h-4" />
                      View Saved Quizzes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-3 w-full justify-center">
                  {studyMode ? (
                    <Button onClick={nextNote} size="lg" className="gap-2 px-8">
                      Next Note
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button onClick={() => startQuiz("standard")} size="lg" className="gap-2 px-8">
                      Try Another Quiz
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                  <Button onClick={() => { setQuizFinished(false); setQuestions([]); setStudyMode(false); }} variant="ghost" size="lg">
                    Back to Menu
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        )}
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 flex items-center justify-between text-sm font-medium text-zinc-500">
        <span>Question {currentIndex + 1} of {questions.length}</span>
        <span>Score: {score}</span>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-indigo-100 shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl leading-relaxed">{currentQuestion.question}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentQuestion.options.map((option, i) => {
                const isCorrect = i === currentQuestion.correctIndex;
                const isSelected = i === selectedOptionIndex;
                
                let variant: "outline" | "default" | "secondary" = "outline";
                let className = "w-full justify-start text-left h-auto py-4 px-6 text-base transition-all ";
                
                if (isAnswered) {
                  if (isCorrect) className += "bg-green-50 border-green-500 text-green-700 hover:bg-green-50 ";
                  else if (isSelected) className += "bg-red-50 border-red-500 text-red-700 hover:bg-red-50 ";
                  else className += "opacity-50 ";
                } else {
                  className += "hover:border-indigo-500 hover:bg-indigo-50/50 ";
                }

                return (
                  <Button
                    key={i}
                    variant={variant}
                    className={className}
                    onClick={() => handleAnswer(i)}
                    disabled={isAnswered}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-grow">{option}</span>
                      {isAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      {isAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500" />}
                    </div>
                  </Button>
                );
              })}
            </CardContent>
            
            {isAnswered && (
              <CardFooter className="flex flex-col items-start gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-6 border-t">
                <div className="space-y-2">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    {selectedOptionIndex === currentQuestion.correctIndex ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Correct!
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Incorrect
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>
                <Button onClick={nextQuestion} className="w-full md:w-auto ml-auto gap-2">
                  {currentIndex === questions.length - 1 ? "Finish Quiz" : "Next Question"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardFooter>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
