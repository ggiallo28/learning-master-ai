import * as duckdb from '@duckdb/duckdb-wasm';
import { Note, QuizResult, LearningPlan, Module, Quiz, Conversation, TopicAnalysis, InitialAssessment, AppData, Flashcard, FlashcardSet, Todo } from '../types';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<{ db: duckdb.AsyncDuckDB; conn: duckdb.AsyncDuckDBConnection }> | null = null;

export async function initDB() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], {type: 'text/javascript'})
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);

    conn = await db.connect();

    // Initialize tables
    await conn.query(`
      CREATE TABLE IF NOT EXISTS learning_plans (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        attachments JSON,
        dueDate TEXT,
        createdAt TEXT
      );
    `);

    // Migration: Add dueDate to learning_plans if it doesn't exist
    try {
      await conn.query(`ALTER TABLE learning_plans ADD COLUMN dueDate TEXT`);
    } catch (e) {
      // Column probably already exists
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS modules (
        id TEXT PRIMARY KEY,
        learningPlanId TEXT,
        parentId TEXT,
        name TEXT,
        description TEXT,
        attachments JSON,
        createdAt TEXT
      );
      CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        learningPlanId TEXT,
        moduleId TEXT,
        questions JSON,
        createdAt TEXT
      );
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        categories TEXT,
        learningPlanId TEXT,
        moduleId TEXT,
        embedding FLOAT[],
        createdAt TEXT,
        updatedAt TEXT
      );
      CREATE TABLE IF NOT EXISTS results (
        id TEXT PRIMARY KEY,
        quizId TEXT,
        learningPlanId TEXT,
        moduleId TEXT,
        score INTEGER,
        totalQuestions INTEGER,
        date TEXT,
        mistakes JSON
      );
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        learningPlanId TEXT,
        role TEXT,
        content TEXT,
        timestamp TEXT
      );
      CREATE TABLE IF NOT EXISTS topic_analysis (
        id TEXT PRIMARY KEY,
        learningPlanId TEXT,
        moduleId TEXT,
        topic TEXT,
        score FLOAT,
        masteryLevel FLOAT,
        improvement FLOAT,
        lastUpdated TEXT
      );
      CREATE TABLE IF NOT EXISTS initial_assessments (
        id TEXT PRIMARY KEY,
        targetId TEXT,
        targetType TEXT,
        rating INTEGER,
        timestamp TEXT
      );
      CREATE TABLE IF NOT EXISTS flashcard_sets (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        learningPlanId TEXT,
        moduleId TEXT,
        createdAt TEXT
      );
      CREATE TABLE IF NOT EXISTS flashcards (
        id TEXT PRIMARY KEY,
        setId TEXT,
        front TEXT,
        back TEXT,
        createdAt TEXT
      );
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        status TEXT,
        dueDate TEXT,
        learningPlanId TEXT,
        moduleId TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        completedAt TEXT,
        duration BIGINT
      );
    `);

    // Initialize FTS index
    try {
      await conn.query(`PRAGMA create_fts_index('notes', 'id', 'title', 'content', 'categories', overwrite=1)`);
    } catch (e) {
      console.error("FTS index creation failed", e);
    }

    return { db, conn };
  })();

  return initPromise;
}

// LearningPlan CRUD
export async function getLearningPlans(): Promise<LearningPlan[]> {
  const { conn } = await initDB();
  const result = await conn!.query(`SELECT * FROM learning_plans ORDER BY createdAt DESC`);
  return result.toArray().map(row => {
    const data = row.toJSON();
    return {
      ...data,
      attachments: data.attachments ? JSON.parse(data.attachments) : []
    } as LearningPlan;
  });
}

export async function saveLearningPlan(lp: LearningPlan) {
  const { conn } = await initDB();
  const name = lp.name.replace(/'/g, "''");
  const description = lp.description.replace(/'/g, "''");
  const attachments = JSON.stringify(lp.attachments || []).replace(/'/g, "''");
  const dueDate = lp.dueDate ? `'${lp.dueDate}'` : 'NULL';
  await conn!.query(`
    INSERT OR REPLACE INTO learning_plans (id, name, description, attachments, dueDate, createdAt)
    VALUES ('${lp.id}', '${name}', '${description}', '${attachments}', ${dueDate}, '${lp.createdAt}')
  `);
}

export async function deleteLearningPlan(id: string) {
  const { conn } = await initDB();
  await conn!.query(`DELETE FROM learning_plans WHERE id = '${id}'`);
  await conn!.query(`DELETE FROM modules WHERE learningPlanId = '${id}'`);
  await conn!.query(`UPDATE notes SET learningPlanId = NULL, moduleId = NULL WHERE learningPlanId = '${id}'`);
}

// Module CRUD
export async function getModules(learningPlanId?: string): Promise<Module[]> {
  const { conn } = await initDB();
  const query = learningPlanId 
    ? `SELECT * FROM modules WHERE learningPlanId = '${learningPlanId}' ORDER BY createdAt DESC`
    : `SELECT * FROM modules ORDER BY createdAt DESC`;
  const result = await conn!.query(query);
  return result.toArray().map(row => {
    const data = row.toJSON();
    return {
      ...data,
      attachments: data.attachments ? JSON.parse(data.attachments) : []
    } as Module;
  });
}

export async function saveModule(module: Module) {
  const { conn } = await initDB();
  const name = module.name.replace(/'/g, "''");
  const description = module.description.replace(/'/g, "''");
  const attachments = JSON.stringify(module.attachments || []).replace(/'/g, "''");
  const parentId = module.parentId ? `'${module.parentId}'` : 'NULL';
  await conn!.query(`
    INSERT OR REPLACE INTO modules (id, learningPlanId, parentId, name, description, attachments, createdAt)
    VALUES ('${module.id}', '${module.learningPlanId}', ${parentId}, '${name}', '${description}', '${attachments}', '${module.createdAt}')
  `);
}

export async function deleteModule(id: string) {
  const { conn } = await initDB();
  await conn!.query(`DELETE FROM modules WHERE id = '${id}' OR parentId = '${id}'`);
  await conn!.query(`UPDATE notes SET moduleId = NULL WHERE moduleId = '${id}'`);
}

export async function searchNotes(query: string, learningPlanId?: string, moduleId?: string): Promise<Note[]> {
  const { conn } = await initDB();
  
  let whereClause = '';
  if (learningPlanId) whereClause += ` AND learningPlanId = '${learningPlanId}'`;
  if (moduleId) whereClause += ` AND moduleId = '${moduleId}'`;

  if (!query) {
    const sql = `SELECT * FROM notes WHERE 1=1 ${whereClause} ORDER BY createdAt DESC`;
    const result = await conn!.query(sql);
    return result.toArray().map(row => {
      const data = row.toJSON();
      return {
        ...data,
        categories: data.categories ? JSON.parse(data.categories) : []
      } as Note;
    });
  }
  
  const escapedQuery = query.replace(/'/g, "''");
  const result = await conn!.query(`
    SELECT * FROM (
      SELECT *, fts_main_notes.match_bm25(id, '${escapedQuery}') AS score
      FROM notes
      WHERE 1=1 ${whereClause}
    ) sq
    WHERE score IS NOT NULL
    ORDER BY score DESC
  `);
  return result.toArray().map(row => {
    const data = row.toJSON();
    return {
      ...data,
      categories: data.categories ? JSON.parse(data.categories) : []
    } as Note;
  });
}

export async function getNotes(learningPlanId?: string, moduleId?: string): Promise<Note[]> {
  const { conn } = await initDB();
  let whereClause = '';
  if (learningPlanId) whereClause += ` WHERE learningPlanId = '${learningPlanId}'`;
  if (moduleId) whereClause += learningPlanId ? ` AND moduleId = '${moduleId}'` : ` WHERE moduleId = '${moduleId}'`;
  
  const result = await conn!.query(`SELECT * FROM notes ${whereClause} ORDER BY createdAt DESC`);
  return result.toArray().map(row => {
    const data = row.toJSON();
    return {
      ...data,
      categories: data.categories ? JSON.parse(data.categories) : []
    } as Note;
  });
}

export async function vectorSearchNotes(vector: number[] | Float32Array, limit: number = 5, learningPlanId?: string, moduleId?: string): Promise<Note[]> {
  const { conn } = await initDB();
  
  if (!vector || (Array.isArray(vector) && vector.length === 0)) return [];
  
  const vectorArray = Array.from(vector);
  if (vectorArray.length === 0) return [];
  
  const vectorStr = `[${vectorArray.join(',')}]`;

  let whereClause = '';
  if (learningPlanId) whereClause += ` AND learningPlanId = '${learningPlanId}'`;
  if (moduleId) whereClause += ` AND moduleId = '${moduleId}'`;

  const result = await conn!.query(`
    SELECT *, 
           (list_dot_product(embedding, CAST('${vectorStr}' AS FLOAT[])) / 
           (NULLIF(sqrt(list_dot_product(embedding, embedding)), 0) * sqrt(list_dot_product(CAST('${vectorStr}' AS FLOAT[]), CAST('${vectorStr}' AS FLOAT[]))))) AS similarity
    FROM notes
    WHERE embedding IS NOT NULL AND list_dot_product(embedding, embedding) > 0 ${whereClause}
    ORDER BY similarity DESC
    LIMIT ${limit}
  `);
  
  return result.toArray().map(row => {
    const data = row.toJSON();
    return {
      ...data,
      categories: data.categories ? JSON.parse(data.categories) : []
    } as Note;
  });
}

export async function getNote(id: string): Promise<Note | null> {
  const { conn } = await initDB();
  const result = await conn!.query(`SELECT * FROM notes WHERE id = '${id}'`);
  const rows = result.toArray();
  if (rows.length === 0) return null;
  const data = rows[0].toJSON();
  return {
    ...data,
    categories: data.categories ? JSON.parse(data.categories) : []
  } as Note;
}

export async function saveNote(note: Note) {
  const { conn } = await initDB();
  const title = note.title.replace(/'/g, "''");
  const content = note.content.replace(/'/g, "''");
  const categories = JSON.stringify(note.categories).replace(/'/g, "''");
  const embeddingStr = (note.embedding && (Array.isArray(note.embedding) || (note.embedding as any) instanceof Float32Array)) 
    ? `CAST('[${Array.from(note.embedding).join(',')}]' AS FLOAT[])` 
    : 'NULL';
  const lpId = note.learningPlanId ? `'${note.learningPlanId}'` : 'NULL';
  const mId = note.moduleId ? `'${note.moduleId}'` : 'NULL';
  
  await conn!.query(`
    INSERT OR REPLACE INTO notes (id, title, content, categories, learningPlanId, moduleId, embedding, createdAt, updatedAt)
    VALUES ('${note.id}', '${title}', '${content}', '${categories}', ${lpId}, ${mId}, ${embeddingStr}, '${note.createdAt}', '${note.updatedAt}')
  `);
}

export async function updateNote(note: Note) {
  const { conn } = await initDB();
  const title = note.title.replace(/'/g, "''");
  const content = note.content.replace(/'/g, "''");
  const categories = JSON.stringify(note.categories).replace(/'/g, "''");
  const embeddingStr = (note.embedding && (Array.isArray(note.embedding) || (note.embedding as any) instanceof Float32Array)) 
    ? `embedding = CAST('[${Array.from(note.embedding).join(',')}]' AS FLOAT[]),` 
    : '';
  const lpId = note.learningPlanId ? `'${note.learningPlanId}'` : 'NULL';
  const mId = note.moduleId ? `'${note.moduleId}'` : 'NULL';
  const updatedAt = new Date().toISOString();
  
  await conn!.query(`
    UPDATE notes 
    SET title = '${title}', content = '${content}', categories = '${categories}', learningPlanId = ${lpId}, moduleId = ${mId}, ${embeddingStr} updatedAt = '${updatedAt}'
    WHERE id = '${note.id}'
  `);
}

export async function deleteNote(id: string) {
  const { conn } = await initDB();
  await conn!.query(`DELETE FROM notes WHERE id = '${id}'`);
}

export async function mergeNotes(sourceId: string, targetId: string) {
  const { conn } = await initDB();
  const source = await getNote(sourceId);
  const target = await getNote(targetId);
  
  if (!source || !target) return;

  const mergedContent = `${target.content}\n\n---\nMerged from ${source.title}:\n${source.content}`;
  
  await conn!.query(`
    UPDATE notes 
    SET content = '${mergedContent.replace(/'/g, "''")}',
        updatedAt = '${new Date().toISOString()}'
    WHERE id = '${targetId}'
  `);
  
  await deleteNote(sourceId);
}

export async function suggestSimilarNotes(noteId: string, limit: number = 3): Promise<Note[]> {
  const note = await getNote(noteId);
  if (!note || !note.embedding) return [];
  
  const similar = await vectorSearchNotes(note.embedding, limit + 1, note.learningPlanId);
  return similar.filter(n => n.id !== noteId);
}

export async function getResults(): Promise<QuizResult[]> {
  const { conn } = await initDB();
  const result = await conn!.query(`SELECT * FROM results ORDER BY date DESC`);
  return result.toArray().map(row => {
    const data = row.toJSON();
    return {
      ...data,
      mistakes: JSON.parse(data.mistakes)
    } as QuizResult;
  });
}

export async function saveResult(result: QuizResult) {
  const { conn } = await initDB();
  const mistakesJson = JSON.stringify(result.mistakes).replace(/'/g, "''");
  const lpId = result.learningPlanId ? `'${result.learningPlanId}'` : 'NULL';
  const mId = result.moduleId ? `'${result.moduleId}'` : 'NULL';
  await conn!.query(`
    INSERT OR REPLACE INTO results (id, quizId, learningPlanId, moduleId, score, totalQuestions, date, mistakes)
    VALUES ('${result.id}', '${result.quizId}', ${lpId}, ${mId}, ${result.score}, ${result.totalQuestions}, '${result.date}', '${mistakesJson}')
  `);
}

export async function getQuizzes(learningPlanId?: string, moduleId?: string): Promise<Quiz[]> {
  const { conn } = await initDB();
  let whereClause = '';
  if (learningPlanId) whereClause += ` WHERE learningPlanId = '${learningPlanId}'`;
  if (moduleId) whereClause += learningPlanId ? ` AND moduleId = '${moduleId}'` : ` WHERE moduleId = '${moduleId}'`;
  
  const result = await conn!.query(`SELECT * FROM quizzes ${whereClause} ORDER BY createdAt DESC`);
  return result.toArray().map(row => {
    const data = row.toJSON();
    return {
      ...data,
      questions: JSON.parse(data.questions)
    } as Quiz;
  });
}

export async function saveQuiz(quiz: Quiz) {
  const { conn } = await initDB();
  const title = quiz.title.replace(/'/g, "''");
  const description = quiz.description.replace(/'/g, "''");
  const questionsJson = JSON.stringify(quiz.questions).replace(/'/g, "''");
  const lpId = quiz.learningPlanId ? `'${quiz.learningPlanId}'` : 'NULL';
  const mId = quiz.moduleId ? `'${quiz.moduleId}'` : 'NULL';
  
  await conn!.query(`
    INSERT OR REPLACE INTO quizzes (id, title, description, learningPlanId, moduleId, questions, createdAt)
    VALUES ('${quiz.id}', '${title}', '${description}', ${lpId}, ${mId}, '${questionsJson}', '${quiz.createdAt}')
  `);
}

export async function deleteQuiz(id: string) {
  const { conn } = await initDB();
  await conn!.query(`DELETE FROM quizzes WHERE id = '${id}'`);
}

// Conversation CRUD
export async function getConversations(learningPlanId?: string): Promise<Conversation[]> {
  const { conn } = await initDB();
  const query = learningPlanId 
    ? `SELECT * FROM conversations WHERE learningPlanId = '${learningPlanId}' ORDER BY timestamp ASC`
    : `SELECT * FROM conversations ORDER BY timestamp ASC`;
  const result = await conn!.query(query);
  return result.toArray().map(row => row.toJSON() as Conversation);
}

export async function saveConversation(conv: Conversation) {
  const { conn } = await initDB();
  const content = conv.content.replace(/'/g, "''");
  await conn!.query(`
    INSERT OR REPLACE INTO conversations (id, learningPlanId, role, content, timestamp)
    VALUES ('${conv.id}', '${conv.learningPlanId}', '${conv.role}', '${content}', '${conv.timestamp}')
  `);
}

// Topic Analysis CRUD
export async function getTopicAnalysis(learningPlanId?: string): Promise<TopicAnalysis[]> {
  const { conn } = await initDB();
  const query = learningPlanId 
    ? `SELECT * FROM topic_analysis WHERE learningPlanId = '${learningPlanId}' ORDER BY lastUpdated DESC`
    : `SELECT * FROM topic_analysis ORDER BY lastUpdated DESC`;
  const result = await conn!.query(query);
  return result.toArray().map(row => row.toJSON() as TopicAnalysis);
}

export async function saveTopicAnalysis(analysis: TopicAnalysis) {
  const { conn } = await initDB();
  const topic = analysis.topic.replace(/'/g, "''");
  const mId = analysis.moduleId ? `'${analysis.moduleId}'` : 'NULL';
  await conn!.query(`
    INSERT OR REPLACE INTO topic_analysis (id, learningPlanId, moduleId, topic, score, masteryLevel, improvement, lastUpdated)
    VALUES ('${analysis.id}', '${analysis.learningPlanId}', ${mId}, '${topic}', ${analysis.score}, ${analysis.masteryLevel}, ${analysis.improvement}, '${analysis.lastUpdated}')
  `);
}

// Initial Assessment CRUD
export async function getInitialAssessments(): Promise<InitialAssessment[]> {
  const { conn } = await initDB();
  const result = await conn!.query(`SELECT * FROM initial_assessments ORDER BY timestamp DESC`);
  return result.toArray().map(row => row.toJSON() as InitialAssessment);
}

export async function saveInitialAssessment(assessment: InitialAssessment) {
  const { conn } = await initDB();
  await conn!.query(`
    INSERT OR REPLACE INTO initial_assessments (id, targetId, targetType, rating, timestamp)
    VALUES ('${assessment.id}', '${assessment.targetId}', '${assessment.targetType}', ${assessment.rating}, '${assessment.timestamp}')
  `);
}

// Flashcard CRUD
export async function getFlashcardSets(learningPlanId?: string, moduleId?: string): Promise<FlashcardSet[]> {
  const { conn } = await initDB();
  let whereClause = '';
  if (learningPlanId) whereClause += ` WHERE learningPlanId = '${learningPlanId}'`;
  if (moduleId) whereClause += learningPlanId ? ` AND moduleId = '${moduleId}'` : ` WHERE moduleId = '${moduleId}'`;
  
  const result = await conn!.query(`SELECT * FROM flashcard_sets ${whereClause} ORDER BY createdAt DESC`);
  return result.toArray().map(row => row.toJSON() as FlashcardSet);
}

export async function saveFlashcardSet(set: FlashcardSet) {
  const { conn } = await initDB();
  const title = set.title.replace(/'/g, "''");
  const description = set.description.replace(/'/g, "''");
  const lpId = set.learningPlanId ? `'${set.learningPlanId}'` : 'NULL';
  const mId = set.moduleId ? `'${set.moduleId}'` : 'NULL';
  
  await conn!.query(`
    INSERT OR REPLACE INTO flashcard_sets (id, title, description, learningPlanId, moduleId, createdAt)
    VALUES ('${set.id}', '${title}', '${description}', ${lpId}, ${mId}, '${set.createdAt}')
  `);
}

export async function deleteFlashcardSet(id: string) {
  const { conn } = await initDB();
  await conn!.query(`DELETE FROM flashcard_sets WHERE id = '${id}'`);
  await conn!.query(`DELETE FROM flashcards WHERE setId = '${id}'`);
}

export async function getFlashcards(setId: string): Promise<Flashcard[]> {
  const { conn } = await initDB();
  const result = await conn!.query(`SELECT * FROM flashcards WHERE setId = '${setId}' ORDER BY createdAt ASC`);
  return result.toArray().map(row => row.toJSON() as Flashcard);
}

export async function saveFlashcard(card: Flashcard) {
  const { conn } = await initDB();
  const front = card.front.replace(/'/g, "''");
  const back = card.back.replace(/'/g, "''");
  await conn!.query(`
    INSERT OR REPLACE INTO flashcards (id, setId, front, back, createdAt)
    VALUES ('${card.id}', '${card.setId}', '${front}', '${back}', '${card.createdAt}')
  `);
}

// Todo CRUD
export async function getTodos(learningPlanId?: string, moduleId?: string): Promise<Todo[]> {
  const { conn } = await initDB();
  let whereClause = '';
  if (learningPlanId) whereClause += ` WHERE learningPlanId = '${learningPlanId}'`;
  if (moduleId) whereClause += learningPlanId ? ` AND moduleId = '${moduleId}'` : ` WHERE moduleId = '${moduleId}'`;
  
  const result = await conn!.query(`SELECT * FROM todos ${whereClause} ORDER BY createdAt DESC`);
  return result.toArray().map(row => {
    const json = row.toJSON() as any;
    // DuckDB returns BIGINT as BigInt, which JSON.stringify cannot handle
    if (json.duration !== null && typeof json.duration === 'bigint') {
      json.duration = Number(json.duration);
    }
    return json as Todo;
  });
}

export async function saveTodo(todo: Todo) {
  const { conn } = await initDB();
  const title = todo.title.replace(/'/g, "''");
  const description = (todo.description || '').replace(/'/g, "''");
  const dueDate = todo.dueDate ? `'${todo.dueDate}'` : 'NULL';
  const completedAt = todo.completedAt ? `'${todo.completedAt}'` : 'NULL';
  const duration = todo.duration !== undefined ? todo.duration : 'NULL';
  const lpId = todo.learningPlanId ? `'${todo.learningPlanId}'` : 'NULL';
  const mId = todo.moduleId ? `'${todo.moduleId}'` : 'NULL';
  
  await conn!.query(`
    INSERT OR REPLACE INTO todos (id, title, description, status, dueDate, learningPlanId, moduleId, createdAt, updatedAt, completedAt, duration)
    VALUES ('${todo.id}', '${title}', '${description}', '${todo.status}', ${dueDate}, ${lpId}, ${mId}, '${todo.createdAt}', '${todo.updatedAt}', ${completedAt}, ${duration})
  `);
}

export async function deleteTodo(id: string) {
  const { conn } = await initDB();
  await conn!.query(`DELETE FROM todos WHERE id = '${id}'`);
}

export async function clearConversations(learningPlanId?: string) {
  const { conn } = await initDB();
  const query = learningPlanId 
    ? `DELETE FROM conversations WHERE learningPlanId = '${learningPlanId}'`
    : `DELETE FROM conversations`;
  await conn!.query(query);
}

export async function getFullDump(): Promise<AppData> {
  const notes = await getNotes();
  const results = await getResults();
  const learningPlans = await getLearningPlans();
  const modules = await getModules();
  const quizzes = await getQuizzes();
  const conversations = await getConversations();
  const topicAnalysis = await getTopicAnalysis();
  const initialAssessments = await getInitialAssessments();
  const flashcardSets = await getFlashcardSets();
  const todos = await getTodos();
  
  const flashcards: Flashcard[] = [];
  for (const set of flashcardSets) {
    const cards = await getFlashcards(set.id);
    flashcards.push(...cards);
  }

  return {
    notes,
    results,
    learningPlans,
    modules,
    quizzes,
    conversations,
    topicAnalysis,
    initialAssessments,
    flashcardSets,
    flashcards,
    todos
  };
}

export async function importDump(data: AppData) {
  await clearAndSeed(
    data.notes,
    data.results,
    data.learningPlans,
    data.modules,
    data.quizzes,
    data.conversations,
    data.topicAnalysis,
    data.initialAssessments,
    data.flashcardSets,
    data.flashcards,
    data.todos
  );
}

export async function clearAndSeed(
  notes: Note[], 
  results: QuizResult[], 
  learningPlans: LearningPlan[] = [], 
  modules: Module[] = [], 
  quizzes: Quiz[] = [],
  conversations: Conversation[] = [],
  topicAnalysis: TopicAnalysis[] = [],
  initialAssessments: InitialAssessment[] = [],
  flashcardSets: FlashcardSet[] = [],
  flashcards: Flashcard[] = [],
  todos: Todo[] = []
) {
  const { conn } = await initDB();
  await conn!.query(`
    DELETE FROM notes; 
    DELETE FROM results; 
    DELETE FROM learning_plans; 
    DELETE FROM modules; 
    DELETE FROM quizzes;
    DELETE FROM conversations;
    DELETE FROM topic_analysis;
    DELETE FROM initial_assessments;
    DELETE FROM flashcard_sets;
    DELETE FROM flashcards;
    DELETE FROM todos;
  `);
  
  for (const lp of learningPlans) await saveLearningPlan(lp);
  for (const m of modules) await saveModule(m);
  for (const note of notes) await saveNote(note);
  for (const quiz of quizzes) await saveQuiz(quiz);
  for (const result of results) await saveResult(result);
  for (const conv of conversations) await saveConversation(conv);
  for (const analysis of topicAnalysis) await saveTopicAnalysis(analysis);
  for (const assessment of initialAssessments) await saveInitialAssessment(assessment);
  for (const set of flashcardSets) await saveFlashcardSet(set);
  for (const card of flashcards) await saveFlashcard(card);
  for (const todo of todos) await saveTodo(todo);
}
