import { useState, useEffect } from "react";
import { AppData, LearningPlan, Module } from "../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { analyzeKnowledgeGaps } from "../lib/gemini";
import { organizeQuickNote } from "../lib/noteAgent";
import { Brain, Trophy, AlertCircle, TrendingUp, ArrowRight, Sparkles, Plus, FolderTree, Layers, MessageSquare, Target, BookOpen, Loader2, Activity, Zap, BarChart3 } from "lucide-react";
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
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
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

  const handleAnalyze = async () => {
    if (totalNotes === 0) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeKnowledgeGaps(filteredNotes, filteredResults);
      
      // Format the JSON result into a nice markdown string
      const formattedAnalysis = `
### Knowledge Gaps
${result.gaps.map((gap: string) => `- ${gap}`).join('\n')}

### Recommendations
${result.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

### Strength Areas
${result.strengthAreas.map((area: string) => `- ${area}`).join('\n')}
      `.trim();
      
      setAnalysis(formattedAnalysis);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

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

  return (
    <div className="space-y-8">
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-[2rem] border border-zinc-100 shadow-sm bg-white overflow-hidden p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Total Notes</span>
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Activity className="h-4 w-4 text-indigo-600" />
            </div>
          </div>
          <div className="text-6xl font-black tracking-tighter text-zinc-900">{totalNotes}</div>
          <p className="text-xs font-medium text-zinc-400 mt-2">Knowledge base size</p>
        </Card>

        <Card className="rounded-[2rem] border border-zinc-100 shadow-sm bg-white overflow-hidden p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Avg. Score</span>
            <div className="p-2 bg-amber-50 rounded-lg">
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
          </div>
          <div className="text-6xl font-black tracking-tighter text-zinc-900">{avgScore}%</div>
          <div className="h-1.5 w-full bg-zinc-100 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${avgScore}%` }} />
          </div>
        </Card>

        <Card className="rounded-[2rem] border border-zinc-100 shadow-sm bg-white overflow-hidden p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Quizzes Taken</span>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
          <div className="text-6xl font-black tracking-tighter text-zinc-900">{totalQuizzes}</div>
          <p className="text-xs font-medium text-zinc-400 mt-2">Practice sessions</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Charts and Analysis */}
        <div className="lg:col-span-5 space-y-8">
          <Card className="rounded-[2.5rem] border border-zinc-100 shadow-sm bg-white p-8">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-zinc-900">
                <div className="p-1.5 bg-indigo-50 rounded-lg">
                  <Plus className="w-4 h-4 text-indigo-600" />
                </div>
                Quick AI Note
              </CardTitle>
              <CardDescription className="text-sm text-zinc-500">Paste messy text and let AI organize it into your notes.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <Textarea 
                placeholder="Paste your messy notes here..."
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                className="min-h-[120px] rounded-3xl bg-zinc-50 border-zinc-100 focus-visible:ring-indigo-500"
              />
              <Button 
                onClick={handleQuickOrganize}
                disabled={!quickInput || isOrganizing}
                className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 font-bold py-6 shadow-lg shadow-indigo-100"
              >
                {isOrganizing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Organizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI Organize & Save
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border border-zinc-100 shadow-sm bg-white p-8">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold text-zinc-900">Recent Performance</CardTitle>
              <CardDescription className="text-sm text-zinc-500">Your score trend over the last 5 quizzes.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 h-[280px]">
              {recentScores.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recentScores}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }}
                    />
                    <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                  <div className="w-16 h-16 rounded-full bg-zinc-50 flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 opacity-20" />
                  </div>
                  <p className="text-sm font-medium text-zinc-400">No quiz data yet. Take a quiz to see your progress!</p>
                  <Button variant="link" size="sm" onClick={onNavigateToQuiz} className="text-indigo-600 font-bold mt-2">Start Quiz</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border border-zinc-100 shadow-sm bg-white p-8">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-zinc-900">
                <div className="p-1.5 bg-indigo-50 rounded-lg">
                  <Target className="w-4 h-4 text-indigo-600" />
                </div>
                Topic Progress
              </CardTitle>
              <CardDescription className="text-sm text-zinc-500">How your knowledge is improving per topic.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-6">
                {data.topicAnalysis.filter(t => !currentLearningPlanId || t.learningPlanId === currentLearningPlanId).length > 0 ? (
                  data.topicAnalysis
                    .filter(t => !currentLearningPlanId || t.learningPlanId === currentLearningPlanId)
                    .map(topic => (
                      <div key={topic.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-bold text-zinc-700">{topic.topic}</span>
                          <span className="text-zinc-400 font-medium">{topic.masteryLevel}%</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-50 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${topic.masteryLevel}%` }} />
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-12 text-zinc-400 text-sm font-medium">
                    No topic analysis available yet. Take more quizzes to see your progress.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border border-zinc-100 shadow-sm bg-white p-8">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-zinc-900">
                <div className="p-1.5 bg-indigo-50 rounded-lg">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                </div>
                AI Knowledge Analysis
              </CardTitle>
              <CardDescription className="text-sm text-zinc-500">Gemini analyzes your notes and mistakes to find gaps.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {analysis ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                    <ReactMarkdown>{analysis}</ReactMarkdown>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing} className="mt-6 rounded-full px-6 font-bold border-indigo-100 text-indigo-600 hover:bg-indigo-50">
                    Refresh Analysis
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm font-medium text-zinc-500 mb-6">
                    {totalNotes > 0 
                      ? "Ready to analyze your knowledge base." 
                      : "Add some notes first to enable AI analysis."}
                  </p>
                  <Button 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing || totalNotes === 0}
                    className="gap-2 rounded-full bg-indigo-600 hover:bg-indigo-700 px-8 py-6 text-base font-bold shadow-lg shadow-indigo-100"
                  >
                    {isAnalyzing ? "Analyzing..." : "Generate Analysis"}
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Chat Assistant */}
        <div className="lg:col-span-7">
          <Card className="border border-zinc-100 shadow-2xl h-[900px] flex flex-col bg-white overflow-hidden rounded-[3rem]">
            <div className="border-b bg-white p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 rounded-2xl">
                    <Sparkles className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900">Study Assistant Chatbot</h3>
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mt-0.5">
                      Context: {data.learningPlans.find(lp => lp.id === currentLearningPlanId)?.name || "Global"}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-xs font-bold text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full px-4">
                  Clear History
                </Button>
              </div>
            </div>
            <div className="p-0 flex-1 relative overflow-hidden bg-zinc-50/30">
              <ChatAssistant 
                learningPlanId={currentLearningPlanId}
                callbacks={agentCallbacks}
                embedded={true}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
