import { useState, useEffect } from "react";
import { AppData, LearningPlan, Module } from "../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { analyzeKnowledgeGaps, organizeQuickNote } from "../lib/ai";
import { Brain, Trophy, AlertCircle, TrendingUp, ArrowRight, Sparkles, Plus, FolderTree, Layers, MessageSquare, Target, BookOpen, Loader2, Activity, Zap, BarChart3, Maximize2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { ChatAssistant } from "./ChatAssistant";

interface DashboardProps {
  data: AppData;
  onNavigateToQuiz: () => void;
  onNavigate: (tab: string) => void;
  onAddLearningPlan: (lp: LearningPlan) => void;
  onAddModule: (module: Module) => void;
  currentLearningPlanId?: string;
  currentModuleId?: string;
  agentCallbacks: {
    onAddNote: (note: any) => Promise<void>;
    onNavigate: (args: any) => void;
    onExportBook: (args: any) => Promise<string>;
  };
}

export function Dashboard({ 
  data, 
  onNavigateToQuiz, 
  onNavigate,
  currentLearningPlanId,
  currentModuleId,
  agentCallbacks
}: DashboardProps) {
  const [isChatFullScreen, setIsChatFullScreen] = useState(false);
  
  // Filter data based on context
  const filteredNotes = data.notes.filter(n => 
    (!currentLearningPlanId || n.learningPlanId === currentLearningPlanId) &&
    (!currentModuleId || n.moduleId === currentModuleId)
  );

  const filteredResults = data.results.filter(r => {
    if (currentModuleId) return r.moduleId === currentModuleId;
    if (currentLearningPlanId) return r.learningPlanId === currentLearningPlanId;
    return true;
  });

  const totalNotes = filteredNotes.length;
  const totalQuizzes = filteredResults.length;
  const avgScore = totalQuizzes > 0 
    ? Math.round(filteredResults.reduce((acc, r) => acc + (r.score / r.totalQuestions) * 100, 0) / totalQuizzes)
    : 0;

  const recentScores = filteredResults.slice(0, 5).reverse().map((r, i) => ({
    name: `Quiz ${i + 1}`,
    score: Math.round((r.score / r.totalQuestions) * 100)
  }));

  const [quickInput, setQuickInput] = useState("");
  const [isOrganizing, setIsOrganizing] = useState(false);

  const handleQuickOrganize = async () => {
    if (!quickInput) return;
    setIsOrganizing(true);
    try {
      const availableModules = data.modules.map(m => ({ id: m.id, name: m.name, description: m.description }));
      const organizedNotes = await organizeQuickNote(quickInput, undefined, availableModules);
      
      for (const organized of organizedNotes) {
        const newNote = {
          title: organized.title,
          content: organized.organizedContent,
          rawContent: quickInput,
          categories: organized.categories,
          learningPlanId: currentLearningPlanId,
          moduleId: organized.moduleId || currentModuleId,
        };
        await agentCallbacks.onAddNote(newNote);
      }

      setQuickInput("");
      toast.success(`AI organized ${organizedNotes.length} note(s)!`);
    } catch (error) {
      toast.error("Failed to organize note.");
    } finally {
      setIsOrganizing(false);
    }
  };

  const currentLP = data.learningPlans.find(lp => lp.id === currentLearningPlanId);

  return (
    <div className="h-full overflow-y-auto no-scrollbar px-8 py-10">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Top Stats Row */}
        {!isChatFullScreen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { label: "Total Notes", value: totalNotes, icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50", description: "Knowledge base size" },
              { label: "Avg. Mastery", value: `${avgScore}%`, icon: Zap, color: "text-amber-500", bg: "bg-amber-50", description: "Based on quiz performance" },
              { label: "Quizzes Taken", value: totalQuizzes, icon: Activity, color: "text-emerald-500", bg: "bg-emerald-50", description: "Practice sessions" },
              { label: "Target Date", value: currentLP?.dueDate ? new Date(currentLP.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "Not Set", icon: Target, color: "text-rose-500", bg: "bg-rose-50", description: "Learning deadline" }
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col gap-6 group hover:shadow-md transition-all hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div className={`p-4 ${stat.bg} dark:bg-zinc-800 rounded-2xl`}>
                    <stat.icon className={`h-8 w-8 ${stat.color}`} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">{stat.label}</p>
                </div>
                <div>
                  <p className="text-4xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">{stat.value}</p>
                  <p className="text-sm text-zinc-500 mt-2 font-medium">{stat.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start min-h-[800px] max-h-[calc(100vh-240px)]">
        {/* Left Column: Charts and Analysis */}
        {!isChatFullScreen && (
          <div className="lg:col-span-5 space-y-8 flex flex-col">
            <Card className="rounded-3xl border border-zinc-100 shadow-sm bg-white p-8">
              <CardHeader className="p-0 mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-zinc-900">Performance Trend</CardTitle>
                    <CardDescription className="text-base text-zinc-500">Your score progress over the last 5 quizzes.</CardDescription>
                  </div>
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-indigo-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 h-[320px] w-full">
                {recentScores.length > 0 ? (
                  <div className="w-full h-full" style={{ minHeight: '320px', minWidth: '0' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <AreaChart data={recentScores}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '16px' }}
                        />
                        <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorScore)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400 bg-zinc-50/50 rounded-2xl border-2 border-dashed border-zinc-100">
                    <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center mb-6">
                      <Trophy className="w-10 h-10 text-zinc-200" />
                    </div>
                    <p className="text-lg font-semibold text-zinc-500">No quiz data yet</p>
                    <p className="text-sm text-zinc-400 max-w-[240px] text-center mt-2">Take your first quiz to start tracking your learning progress.</p>
                    <Button onClick={onNavigateToQuiz} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold mt-6 rounded-full px-8 py-6 h-auto">
                      Start First Quiz
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-8 flex-1">
              <Card className="rounded-3xl border border-zinc-100 shadow-sm bg-white p-8 flex flex-col">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="flex items-center gap-3 text-xl font-bold text-zinc-900">
                    <div className="p-2 bg-indigo-50 rounded-xl">
                      <MessageSquare className="w-5 h-5 text-indigo-600" />
                    </div>
                    Quick Note
                  </CardTitle>
                  <CardDescription className="text-sm text-zinc-500">AI will organize your thoughts.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col gap-4">
                  <Textarea 
                    placeholder="Paste text or type notes here..."
                    value={quickInput}
                    onChange={(e) => setQuickInput(e.target.value)}
                    className="flex-1 min-h-[120px] rounded-2xl border-zinc-100 focus-visible:ring-indigo-500 resize-none p-4"
                  />
                  <Button 
                    onClick={handleQuickOrganize} 
                    disabled={isOrganizing || !quickInput}
                    className="w-full rounded-full h-12 font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                  >
                    {isOrganizing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Organize with AI
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Right Column: Chat Assistant */}
        <div className={`${isChatFullScreen ? 'lg:col-span-12' : 'lg:col-span-7'} flex flex-col transition-all duration-500 h-[800px]`}>
          <Card className="border border-zinc-100 shadow-xl h-full flex flex-col bg-white overflow-hidden rounded-3xl relative">
            <div className="absolute top-6 right-6 z-10">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setIsChatFullScreen(!isChatFullScreen)}
                className="rounded-full bg-white/80 backdrop-blur-sm border-zinc-200 shadow-sm hover:bg-indigo-50 hover:text-indigo-600 transition-all"
              >
                {isChatFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
            <div className="p-0 flex-1 relative overflow-hidden bg-zinc-50/20">
              <ChatAssistant 
                learningPlanId={currentLearningPlanId}
                callbacks={agentCallbacks}
                embedded={true}
                data={data}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  </div>
  );
}
