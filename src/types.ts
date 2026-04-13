export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string; // Extracted text content
  url?: string;
  createdAt: string;
}

export interface LearningPlan {
  id: string;
  name: string;
  description: string;
  attachments?: Attachment[];
  createdAt: string;
}

export interface Module {
  id: string;
  learningPlanId: string;
  parentId?: string; // For submodules
  name: string;
  description: string;
  attachments?: Attachment[];
  createdAt: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  learningPlanId?: string;
  moduleId?: string;
  questions: QuizQuestion[];
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  rawContent?: string;
  categories: string[];
  learningPlanId?: string;
  moduleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizResult {
  id: string;
  quizId: string;
  learningPlanId?: string;
  moduleId?: string;
  score: number;
  totalQuestions: number;
  date: string;
  mistakes: {
    question: string;
    userAnswer: string;
    correctAnswer: string;
    explanation: string;
  }[];
}

export interface AppData {
  notes: Note[];
  results: QuizResult[];
  learningPlans: LearningPlan[];
  modules: Module[];
  quizzes: Quiz[];
  conversations: Conversation[];
  topicAnalysis: TopicAnalysis[];
  initialAssessments: InitialAssessment[];
  flashcardSets: FlashcardSet[];
  flashcards: Flashcard[];
}

export interface Conversation {
  id: string;
  learningPlanId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface TopicAnalysis {
  id: string;
  learningPlanId: string;
  moduleId?: string;
  topic: string;
  score: number; // 0-100
  masteryLevel: number; // 0-100
  improvement: number; // trend
  lastUpdated: string;
}

export interface InitialAssessment {
  id: string;
  targetId: string; // learningPlanId or moduleId
  targetType: 'learningPlan' | 'module';
  rating: number; // 1-5
  timestamp: string;
}

export interface Flashcard {
  id: string;
  setId: string;
  front: string;
  back: string;
  createdAt: string;
}

export interface FlashcardSet {
  id: string;
  title: string;
  description: string;
  learningPlanId?: string;
  moduleId?: string;
  createdAt: string;
}
