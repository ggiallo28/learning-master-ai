import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { askStudyAssistant } from "../lib/noteAgent";
import { MessageSquare, Send, Bot, User, Loader2, Minimize2, Maximize2, X, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatAssistantProps {
  learningPlanId?: string;
  moduleId?: string;
  embedded?: boolean;
  callbacks: {
    onAddNote: (note: any) => Promise<void>;
    onNavigate: (args: any) => void;
    onExportBook: (args: any) => Promise<string>;
    onSaveConversation?: (conv: any) => Promise<void>;
  };
}

export function ChatAssistant({ learningPlanId, moduleId, callbacks, embedded = false }: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I'm your Learning Master AI Study Assistant. How can I help you today? I can search your notes, create new ones, or help you navigate the app." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await askStudyAssistant(userMessage, history, {
        learningPlanId,
        moduleId,
        callbacks
      });

      setMessages(prev => [...prev, { role: "assistant", content: response }]);
      
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
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
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
    <Card className={`flex flex-col shadow-2xl border-indigo-100 overflow-hidden ${embedded ? "h-full shadow-none border-none" : "h-full"}`}>
      {!embedded && (
        <CardHeader className="bg-indigo-600 text-white p-4 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <CardTitle className="text-sm font-bold">Study Assistant</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-indigo-500" onClick={() => setIsMinimized(true)}>
              <Minimize2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-indigo-500" onClick={() => setMessages([{ role: "assistant", content: "Chat reset. How can I help?" }])}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
      )}
      
      <CardContent className="flex-grow overflow-hidden p-0 relative">
        <ScrollArea className="h-full p-8">
          <div className="space-y-6">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex gap-4 max-w-[90%] ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${m.role === "user" ? "bg-white border" : "bg-indigo-100"}`}>
                    {m.role === "user" ? <User className="w-5 h-5 text-zinc-600" /> : <Bot className="w-5 h-5 text-indigo-600" />}
                  </div>
                  <div className={`p-5 rounded-[2rem] text-sm leading-relaxed ${m.role === "user" ? "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-100" : "bg-white border border-zinc-100 text-zinc-800 rounded-tl-none shadow-sm"}`}>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-4 items-center bg-white border border-zinc-100 p-4 rounded-[2rem] rounded-tl-none shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  </div>
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Thinking...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="p-8 bg-white border-t">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="relative w-full"
        >
          <Input
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="w-full h-14 pl-6 pr-14 rounded-full border-zinc-200 focus-visible:ring-indigo-500 bg-zinc-50/50 text-base"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isLoading || !input.trim()} 
            className="absolute right-2 top-2 h-10 w-10 rounded-full bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all"
          >
            <Send className="w-4 h-4" />
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
