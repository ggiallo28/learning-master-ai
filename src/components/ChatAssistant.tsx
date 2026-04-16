import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { askStudyAssistant, analyzeKnowledgeGaps } from "../lib/ai";
import { MessageSquare, Send, Bot, User, Loader2, Minimize2, Maximize2, X, RefreshCw, Sparkles, ChevronDown, ChevronUp, Target, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { AppData } from "../types";
import { Progress } from "@/components/ui/progress";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatAssistantProps {
  learningPlanId?: string;
  moduleId?: string;
  embedded?: boolean;
  initialMessage?: string;
  data: AppData;
  callbacks: {
    onAddNote: (note: any) => Promise<void>;
    onNavigate: (args: any) => void;
    onExportBook: (args: any) => Promise<string>;
    onSaveConversation?: (conv: any) => Promise<void>;
    onClearHistory?: () => Promise<void>;
  };
}

export function ChatAssistant({ learningPlanId, moduleId, callbacks, embedded = false, initialMessage, data }: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const notes = data.notes;

  useEffect(() => {
    // Suggest questions toast
    const timer = setTimeout(() => {
      toast("Try asking:", {
        description: "What are my weakest topics? or How can I improve my mastery?",
        action: {
          label: "Ask AI",
          onClick: () => setInput("What are my weakest topics?")
        },
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleAnalyze = async () => {
    const filteredNotes = data.notes.filter(n => 
      (!learningPlanId || n.learningPlanId === learningPlanId) &&
      (!moduleId || n.moduleId === moduleId)
    );
    const filteredResults = data.results.filter(r => {
      if (moduleId) return r.moduleId === moduleId;
      if (learningPlanId) return r.learningPlanId === learningPlanId;
      return true;
    });

    if (filteredNotes.length === 0) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeKnowledgeGaps(filteredNotes, filteredResults);
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
      toast.error("Failed to analyze knowledge gaps");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      scrollContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior
      });
    }
  };

  const handleClearHistory = async () => {
    setMessages([{ role: "assistant", content: "Chat reset. How can I help?" }]);
    if (callbacks.onClearHistory) {
      await callbacks.onClearHistory();
    }
    toast.success("Chat history cleared");
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isStreaming]);

  useEffect(() => {
    if (initialMessage) {
      setMessages([{ role: "assistant", content: "Hello! I'm ready to help you with this specific note. What would you like to know?" }]);
    } else {
      setMessages([
        { role: "assistant", content: "Hello! I'm your Learning Master AI Study Assistant. How can I help you today? I can search your notes, create new ones, or help you navigate the app." }
      ]);
    }
  }, [initialMessage]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    setIsStreaming(false);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await askStudyAssistant(userMessage, history, {
        learningPlanId,
        moduleId,
        callbacks,
        notes
      }, (token) => {
        setIsStreaming(true);
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === "assistant") {
            lastMessage.content += token;
            return newMessages;
          } else {
            return [...prev, { role: "assistant", content: token }];
          }
        });
      });

      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === "assistant") {
          lastMessage.content = response;
          return newMessages;
        } else {
          return [...prev, { role: "assistant", content: response }];
        }
      });
      
      if (callbacks.onSaveConversation) {
        await callbacks.onSaveConversation({
          id: crypto.randomUUID(),
          learningPlanId: learningPlanId || null,
          role: "user",
          content: userMessage,
          timestamp: new Date().toISOString()
        });
        await callbacks.onSaveConversation({
          id: crypto.randomUUID(),
          learningPlanId: learningPlanId || null,
          role: "assistant",
          content: response,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === "assistant") {
          lastMessage.content = "Sorry, I encountered an error. Please try again.";
          return newMessages;
        } else {
          return [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }];
        }
      });
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  if (isMinimized && !embedded) {
    return (
      <Button 
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-2xl bg-indigo-600 hover:bg-indigo-700 z-50"
      >
        <MessageSquare className="w-6 h-6" />
      </Button>
    );
  }

  const chatContent = (
    <Card className={`flex flex-col shadow-2xl border-zinc-100 overflow-hidden min-h-0 ${embedded ? "h-full shadow-none border-none bg-transparent" : "h-full bg-white dark:bg-zinc-900 rounded-[2.5rem]"}`}>
      {!embedded && (
        <CardHeader className="bg-indigo-600 text-white p-6 flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/20">
              <Bot className="text-white w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-white">Study Assistant</CardTitle>
              <p className="text-[8px] font-bold uppercase tracking-widest text-indigo-100">AI Powered</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full" onClick={() => setIsMinimized(true)}>
              <Minimize2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-white/20" onClick={handleClearHistory}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
      )}
      
      <CardContent className="flex-1 min-h-0 overflow-hidden p-0 relative flex flex-col">
        {/* Capabilities Toggle */}
        <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">AI Capabilities</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCapabilities(!showCapabilities)}
            className="h-8 px-3 rounded-full text-xs font-bold text-indigo-600 hover:bg-indigo-50"
          >
            {showCapabilities ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
            {showCapabilities ? "Hide" : "Show"} Analysis
          </Button>
        </div>

        <AnimatePresence>
          {showCapabilities && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 200, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0"
            >
              <div className="p-6 space-y-6 h-full overflow-y-auto no-scrollbar">
                {/* Topic Mastery */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-600" />
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Topic Mastery</h4>
                  </div>
                  <div className="space-y-4">
                    {data.topicAnalysis.filter(t => !learningPlanId || t.learningPlanId === learningPlanId).length > 0 ? (
                      data.topicAnalysis
                        .filter(t => !learningPlanId || t.learningPlanId === learningPlanId)
                        .map(topic => (
                          <div key={topic.id} className="space-y-2">
                            <div className="flex justify-between text-[11px]">
                              <span className="font-bold text-zinc-700 dark:text-zinc-300">{topic.topic}</span>
                              <span className="text-indigo-600 font-bold">{topic.masteryLevel}%</span>
                            </div>
                            <Progress value={topic.masteryLevel} className="h-1.5" />
                          </div>
                        ))
                    ) : (
                      <p className="text-xs text-zinc-400 italic">No mastery data yet. Take quizzes to see analysis.</p>
                    )}
                  </div>
                </div>

                <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

                {/* AI Insights */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">AI Insights</h4>
                  </div>
                  {analysis ? (
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700 text-xs leading-relaxed prose prose-xs dark:prose-invert max-w-none">
                        <ReactMarkdown>{analysis}</ReactMarkdown>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing} className="w-full rounded-full h-9 text-xs font-bold border-indigo-100 text-indigo-600 hover:bg-indigo-50">
                        Refresh Analysis
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-zinc-500 mb-4">Ready to analyze your knowledge base.</p>
                      <Button 
                        onClick={handleAnalyze} 
                        disabled={isAnalyzing || data.notes.length === 0}
                        size="sm"
                        className="rounded-full bg-indigo-600 hover:bg-indigo-700 px-6 font-bold"
                      >
                        {isAnalyzing ? "Analyzing..." : "Analyze Gaps"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div 
          ref={scrollContainerRef}
          className="flex-1 w-full overflow-y-auto no-scrollbar scroll-smooth"
        >
          <div className={`space-y-6 ${embedded ? "p-4" : "p-6"}`}>
            {messages.map((m, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`flex gap-4 max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${m.role === "user" ? "bg-white dark:bg-zinc-800 border-zinc-100" : "bg-indigo-50 dark:bg-indigo-900/30"}`}>
                    {m.role === "user" ? <User className="w-5 h-5 text-zinc-600 dark:text-zinc-400" /> : <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                  </div>
                  <div className={`p-5 rounded-[2rem] text-base leading-relaxed shadow-sm break-words overflow-hidden ${
                    m.role === "user" 
                      ? "bg-indigo-600 text-white rounded-tr-none shadow-indigo-100" 
                      : "bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-tl-none"
                  }`}>
                    <div className="prose prose-base dark:prose-invert max-w-none">
                      <ReactMarkdown>{typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {isLoading && !isStreaming && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="flex gap-4 items-center bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 p-5 rounded-[2rem] rounded-tl-none shadow-sm">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Thinking...</span>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </CardContent>

      <CardFooter className={`${embedded ? "p-6" : "p-10"} border-t border-zinc-100 dark:border-zinc-800 ${embedded ? "bg-transparent" : "bg-white dark:bg-zinc-900"}`}>
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="relative w-full"
        >
          <Input
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="w-full h-16 pl-8 pr-20 rounded-full border-zinc-200 dark:border-zinc-700 focus-visible:ring-indigo-500 bg-zinc-50/50 dark:bg-zinc-800/50 text-lg font-medium"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isLoading || !input.trim()} 
            className="absolute right-2.5 top-2.5 h-11 w-11 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none transition-all"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );

  if (embedded) {
    return chatContent;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-6 right-6 w-[400px] h-[600px] z-50"
      >
        {chatContent}
      </motion.div>
    </AnimatePresence>
  );
}
