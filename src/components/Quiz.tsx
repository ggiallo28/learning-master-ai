import { useState } from "react";
import { Note, QuizQuestion, QuizResult, LearningPlan, Module, Quiz as QuizType } from "../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { generateQuizFromNotes } from "../lib/ai";
import { Brain, CheckCircle2, XCircle, ArrowRight, Loader2, RefreshCw, BookOpen, FolderTree, Layers, Save, History, Sparkles, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Todo } from "../types";

interface QuizProps {
  notes: Note[];
  quizzes: QuizType[];
  onComplete: (result: QuizResult) => void;
  onSaveQuiz: (quiz: QuizType) => void;
  onAddTodo?: (todo: Todo) => void;
  currentLearningPlanId?: string;
  currentModuleId?: string;
  learningPlans: LearningPlan[];
  modules: Module[];
}

export function Quiz({ notes, quizzes, onComplete, onSaveQuiz, onAddTodo, currentLearningPlanId, currentModuleId, learningPlans, modules }: QuizProps) {
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

  const startQuiz = async (mode: "standard" | "study" = "standard", moduleId?: string) => {
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
      } else if (moduleId) {
        targetNotes = notes.filter(n => n.moduleId === moduleId);
        if (targetNotes.length === 0) {
          toast.error("No notes found for this topic.");
          setIsGenerating(false);
          return;
        }
      }

      const lp = learningPlans.find(l => l.id === currentLearningPlanId);
      const m = moduleId ? modules.find(mod => mod.id === moduleId) : modules.find(mod => mod.id === currentModuleId);

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
    setStudyMode(false);
  };

  if (notes.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="border-dashed border-2 border-zinc-200 flex flex-col items-center justify-center p-20 text-center bg-zinc-50/50 dark:bg-zinc-900/50 rounded-[3rem]">
          <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center mb-6 shadow-sm border border-zinc-100">
            <Brain className="w-10 h-10 text-indigo-500" />
          </div>
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">No Notes Found</h3>
          <p className="text-base text-zinc-500 max-w-sm mt-3">Add some notes first to generate AI-powered challenges and test your knowledge.</p>
        </Card>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-8">
        <div className="w-24 h-24 rounded-3xl bg-indigo-50 flex items-center justify-center animate-bounce shadow-lg">
          <Brain className="w-12 h-12 text-indigo-600" />
        </div>
        <div className="space-y-3 text-center">
          <p className="text-2xl font-bold text-zinc-900">
            {isMistakeFollowUp ? "Reinforcing weak points..." : "Crafting your challenge..."}
          </p>
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-bold">
            {currentLearningPlanId ? learningPlans.find(lp => lp.id === currentLearningPlanId)?.name : "All Topics"}
            {currentModuleId ? ` > ${modules.find(m => m.id === currentModuleId)?.name}` : ""}
          </p>
        </div>
      </div>
    );
  }

  if (questions.length === 0 || quizFinished) {
    const quizModules = modules.filter(m => !currentLearningPlanId || m.learningPlanId === currentLearningPlanId);

    return (
      <div className="space-y-8 max-w-6xl mx-auto">
        <Card className="border-none shadow-sm overflow-hidden rounded-[3rem] bg-white dark:bg-zinc-900">
          <CardHeader className="text-center pt-12 pb-6 px-8">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner"
            >
              <Brain className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </motion.div>
            <CardTitle className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-3">
              {quizFinished ? "Results Analyzed" : "Knowledge Challenge"}
            </CardTitle>
            <CardDescription className="text-base text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              {quizFinished 
                ? `You mastered ${score}/${questions.length} concepts. Great progress!`
                : "Select a topic to start an AI-powered practice session tailored to your notes."}
            </CardDescription>
            
            <div className="flex items-center justify-center gap-3 mt-6">
              {currentLearningPlanId && (
                <span className="flex items-center gap-2 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-1.5 rounded-full font-bold uppercase tracking-wider">
                  <FolderTree className="w-4 h-4" />
                  {learningPlans.find(lp => lp.id === currentLearningPlanId)?.name}
                </span>
              )}
              <span className="flex items-center gap-2 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-4 py-1.5 rounded-full font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                Adaptive AI
              </span>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-12">
            {quizFinished ? (
              <div className="space-y-10">
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Button onClick={() => startQuiz("standard")} size="lg" className="gap-2 px-8 h-12 rounded-full font-bold shadow-lg bg-indigo-600 hover:bg-indigo-700">
                    <RefreshCw className="w-5 h-5" />
                    Retake Quiz
                  </Button>
                  <Button variant="outline" size="lg" onClick={handleSaveCurrentQuiz} className="gap-2 text-indigo-600 border-indigo-100 rounded-full px-8 h-12 font-bold hover:bg-indigo-50">
                    <Save className="w-5 h-5" />
                    Save Quiz
                  </Button>
                  <Button onClick={() => { setQuizFinished(false); setQuestions([]); setStudyMode(false); }} variant="ghost" size="lg" className="h-12 rounded-full px-8 font-bold text-zinc-400 hover:text-zinc-600">
                    Back to Selection
                  </Button>
                </div>

                {mistakes.length > 0 ? (
                  <div className="space-y-8 pt-10 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-2xl text-zinc-900 dark:text-zinc-100 flex items-center gap-4">
                        <XCircle className="w-7 h-7 text-rose-500" />
                        Areas for Improvement
                      </h4>
                      <Button onClick={startMistakeFollowUp} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6 h-10 font-bold shadow-md gap-2 text-xs uppercase tracking-wider">
                        <Sparkles className="w-4 h-4" />
                        Reinforce Weak Points
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      {mistakes.map((m, i) => (
                        <div key={i} className="p-6 rounded-3xl bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 space-y-4 group">
                          <div className="flex justify-between items-start gap-6">
                            <p className="font-bold text-lg text-zinc-800 dark:text-zinc-200 leading-tight flex-1">{m.question}</p>
                            {onAddTodo && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                  onAddTodo({
                                    id: crypto.randomUUID(),
                                    title: `Review: ${m.question.substring(0, 50)}...`,
                                    description: `Mistake in quiz. Correct answer: ${m.correctAnswer}. Explanation: ${m.explanation}`,
                                    status: 'todo',
                                    learningPlanId: currentLearningPlanId,
                                    moduleId: currentModuleId,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString()
                                  });
                                  toast.success("Added to study list!");
                                }}
                                className="rounded-full h-9 px-4 font-bold text-[10px] uppercase tracking-wider border-dashed opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5 mr-2" />
                                Add to Tasks
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-red-100 shadow-sm">
                              <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block mb-1.5">Your answer</span>
                              <p className="text-sm font-bold text-red-700">{m.userAnswer}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-emerald-100 shadow-sm">
                              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block mb-1.5">Correct Answer</span>
                              <p className="text-sm font-bold text-emerald-700">{m.correctAnswer}</p>
                            </div>
                          </div>
                          <div className="text-sm text-zinc-500 leading-relaxed prose prose-sm dark:prose-invert max-w-none pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.explanation}</ReactMarkdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-10 rounded-[2.5rem] bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-center"
                  >
                    <p className="text-emerald-800 dark:text-emerald-400 font-bold text-2xl">Perfect Mastery!</p>
                    <p className="text-emerald-600/80 mt-2">You've mastered all concepts in this session.</p>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Global Challenge Card */}
                  <motion.div 
                    whileHover={{ y: -4 }}
                    className="p-8 rounded-[2.5rem] bg-indigo-600 text-white shadow-xl cursor-pointer group relative overflow-hidden"
                    onClick={() => startQuiz("standard")}
                  >
                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>
                      <h4 className="text-2xl font-bold mb-2">Full Knowledge Sprint</h4>
                      <p className="text-indigo-100 text-sm mb-8 leading-relaxed">A comprehensive AI-generated quiz covering all your notes and study materials.</p>
                      <Button size="lg" className="w-full bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl h-12 font-bold text-sm">
                        Start Sprint
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </motion.div>

                  {/* Recent Quizzes / History */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                      <History className="w-5 h-5 text-zinc-400" />
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Recent Sessions</h4>
                    </div>
                    <div className="space-y-3">
                      {quizzes.length > 0 ? (
                        quizzes.slice(0, 3).map(q => (
                          <div 
                            key={q.id} 
                            onClick={() => loadSavedQuiz(q)}
                            className="p-4 rounded-2xl border border-zinc-100 hover:border-indigo-200 bg-zinc-50/50 hover:bg-white transition-all cursor-pointer group flex items-center justify-between shadow-sm"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-white border border-zinc-100 flex items-center justify-center group-hover:bg-indigo-50 transition-all shrink-0">
                                <Brain className="w-5 h-5 text-zinc-400 group-hover:text-indigo-600" />
                              </div>
                              <div className="min-w-0">
                                <h5 className="font-bold text-sm text-zinc-800 group-hover:text-indigo-600 truncate">{q.title}</h5>
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{new Date(q.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-indigo-600 shrink-0" />
                          </div>
                        ))
                      ) : (
                        <div className="p-8 rounded-2xl border border-dashed border-zinc-200 text-center bg-zinc-50/30">
                          <p className="text-sm font-medium text-zinc-400">No quiz history yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Module Specific Challenges */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <Layers className="w-5 h-5 text-zinc-400" />
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Topic Challenges</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {quizModules.map(m => (
                      <motion.div 
                        key={m.id}
                        whileHover={{ y: -4 }}
                        transition={{ duration: 0.2 }}
                        className="group cursor-pointer"
                        onClick={() => startQuiz("standard", m.id)}
                      >
                        <Card className="p-5 rounded-2xl border border-zinc-100 bg-white hover:border-indigo-200 hover:shadow-md transition-all flex flex-col h-full relative overflow-hidden">
                          <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                            <Layers className="w-5 h-5 text-zinc-400" />
                          </div>
                          
                          <h5 className="font-bold text-sm text-zinc-800 mb-1 group-hover:text-indigo-600 transition-colors truncate">{m.name}</h5>
                          <p className="text-xs text-zinc-500 line-clamp-2 mb-4 leading-relaxed">{m.description}</p>
                          
                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-50">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                              {notes.filter(n => n.moduleId === m.id).length} Notes
                            </span>
                            <div className="w-7 h-7 rounded-full bg-zinc-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                              <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div className="h-2 w-48 bg-zinc-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-indigo-600"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Question {currentIndex + 1} of {questions.length}</span>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-sm font-bold">
          <Sparkles className="w-4 h-4" />
          Score: {score}
        </div>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
        >
          <Card className="border-zinc-100 shadow-xl rounded-3xl overflow-hidden bg-white dark:bg-zinc-900">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-bold leading-tight text-zinc-800 dark:text-zinc-100">{currentQuestion.question}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-8 pb-8">
              {currentQuestion.options.map((option, i) => {
                const isCorrect = i === currentQuestion.correctIndex;
                const isSelected = i === selectedOptionIndex;
                
                let className = "w-full justify-start text-left h-auto py-4 px-6 text-base transition-all rounded-2xl border-2 ";
                
                if (isAnswered) {
                  if (isCorrect) className += "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm ";
                  else if (isSelected) className += "bg-red-50 border-red-500 text-red-700 shadow-sm ";
                  else className += "opacity-40 border-zinc-100 ";
                } else {
                  className += "hover:border-indigo-500 hover:bg-indigo-50/30 border-zinc-100 bg-zinc-50/30 ";
                }

                return (
                  <Button
                    key={i}
                    variant="outline"
                    className={className}
                    onClick={() => handleAnswer(i)}
                    disabled={isAnswered}
                  >
                    <div className="flex items-center gap-4 w-full">
                      <span className={`flex-shrink-0 w-8 h-8 rounded-xl border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                        isAnswered && isCorrect ? 'bg-emerald-500 border-emerald-500 text-white' : 
                        isAnswered && isSelected ? 'bg-red-500 border-red-500 text-white' : 
                        'bg-white border-zinc-200 text-zinc-400'
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-grow font-medium break-words overflow-hidden">{option}</span>
                      {isAnswered && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
                      {isAnswered && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                    </div>
                  </Button>
                );
              })}
            </CardContent>
            
            {isAnswered && (
              <CardFooter className="flex flex-col items-start gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-8 border-t border-zinc-100">
                <div className="space-y-2 w-full">
                  <div className="flex items-center gap-3">
                    {selectedOptionIndex === currentQuestion.correctIndex ? (
                      <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3" /> Correct!
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        <XCircle className="w-3 h-3" /> Incorrect
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed prose prose-zinc dark:prose-invert max-w-none pt-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentQuestion.explanation}</ReactMarkdown>
                  </div>
                </div>
                <Button onClick={nextQuestion} size="lg" className="w-full md:w-auto ml-auto gap-2 h-12 px-8 rounded-full text-base font-bold shadow-lg shadow-indigo-100">
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
