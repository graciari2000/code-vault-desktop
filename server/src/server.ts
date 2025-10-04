import express, { Request, Response } from 'express';
import cors from 'cors';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 8802;

// MongoDB Atlas connection - use environment variable in production
const MONGODB_URI = process.env.MONGODB_URI;

// MongoDB client setup with proper TLS configuration
const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  tls: true,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  w: 'majority'
});

// Database and collection references
let db: any;
let snippetsCollection: any;

// Interface definitions
interface Snippet {
  id: string;
  title: string;
  code: string;
  language: string;
  description?: string;
  tags: string[];
  createdAt: string;
}

interface SnippetDocument {
  _id: ObjectId;
  title: string;
  code: string;
  language: string;
  description?: string;
  tags: string[];
  createdAt: Date;
  updatedAt?: Date;
}

interface AISuggestion {
  snippet: Snippet;
  reason: string;
  confidence: number;
  context: string;
}

// Connect to MongoDB with error handling
async function connectToDatabase() {
  try {
    console.log('🔗 Connecting to MongoDB Atlas...');
    await client.connect();
    db = client.db('codevault');
    snippetsCollection = db.collection('snippets');
    console.log('✅ Connected to MongoDB Atlas');
    
    // Create regular indexes (remove text indexes due to API Strict Mode)
    await snippetsCollection.createIndex({ language: 1 });
    await snippetsCollection.createIndex({ tags: 1 });
    await snippetsCollection.createIndex({ createdAt: -1 });
    
    console.log('✅ Database indexes created');
    
    // Insert sample data if collection is empty
    const snippetCount = await snippetsCollection.countDocuments();
    if (snippetCount === 0) {
      await insertSampleData();
    }
  } catch (error: any) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

// Insert sample data
async function insertSampleData() {
  const sampleSnippets: SnippetDocument[] = [
    {
      _id: new ObjectId(),
      title: 'React Hook Form Setup',
      code: `const { register, handleSubmit, formState: { errors } } = useForm();\nconst onSubmit = data => console.log(data);`,
      language: 'typescript',
      description: 'Basic setup for React Hook Form with TypeScript',
      tags: ['react', 'form', 'hook'],
      createdAt: new Date()
    },
    {
      _id: new ObjectId(),
      title: 'API Fetch Wrapper',
      code: `async function apiFetch(url, options = {}) {\n  const response = await fetch(url, {\n    headers: { 'Content-Type': 'application/json' },\n    ...options\n  });\n  return response.json();\n}`,
      language: 'javascript',
      description: 'Generic fetch wrapper for API calls',
      tags: ['api', 'utility', 'http'],
      createdAt: new Date()
    }
  ];

  try {
    await snippetsCollection.insertMany(sampleSnippets);
    console.log('✅ Sample data inserted');
  } catch (error: any) {
    console.error('Error inserting sample data:', error);
  }
}

// Middleware - FIXED CORS CONFIGURATION
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// Health check
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    await db.command({ ping: 1 });
    const snippetCount = await snippetsCollection.countDocuments();
    
    res.json({ 
      status: 'OK', 
      message: 'Code Vault server is running with MongoDB Atlas',
      database: 'Connected to MongoDB Atlas',
      totalSnippets: snippetCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      status: 'Error', 
      message: 'Database connection failed',
      error: error.message 
    });
  }
});

// Get all snippets - FIXED RESPONSE FORMAT
app.get('/api/snippets', async (req: Request, res: Response) => {
  try {
    const { search, language, tag, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    let query: any = {};
    
    // Search across multiple fields using regex (since text search is disabled)
    if (search && typeof search === 'string') {
      query = {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ]
      };
    }
    
    // Filter by language
    if (language && language !== 'all' && typeof language === 'string') {
      query.language = language;
    }
    
    // Filter by tag
    if (tag && tag !== 'all' && typeof tag === 'string') {
      query.tags = tag;
    }
    
    // Sort configuration
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;
    
    const snippets = await snippetsCollection
      .find(query)
      .sort(sortOptions)
      .toArray();
    
    // Convert MongoDB _id to id for frontend compatibility
    const formattedSnippets: Snippet[] = snippets.map((snippet: SnippetDocument) => ({
      id: snippet._id.toString(),
      title: snippet.title,
      code: snippet.code,
      language: snippet.language,
      description: snippet.description,
      tags: snippet.tags || [],
      createdAt: snippet.createdAt.toISOString()
    }));
    
    // RETURN JUST THE ARRAY, not an object with status
    res.json(formattedSnippets);
  } catch (error: any) {
    console.error('Error fetching snippets:', error);
    res.status(500).json({ error: 'Failed to fetch snippets' });
  }
});

// Get single snippet by ID
app.get('/api/snippets/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid snippet ID' });
    }
    
    const snippet = await snippetsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!snippet) {
      return res.status(404).json({ error: 'Snippet not found' });
    }
    
    // Convert MongoDB _id to id
    const formattedSnippet: Snippet = {
      id: snippet._id.toString(),
      title: snippet.title,
      code: snippet.code,
      language: snippet.language,
      description: snippet.description,
      tags: snippet.tags || [],
      createdAt: snippet.createdAt.toISOString()
    };
    
    res.json(formattedSnippet);
  } catch (error: any) {
    console.error('Error fetching snippet:', error);
    res.status(500).json({ error: 'Failed to fetch snippet' });
  }
});

// Create new snippet
app.post('/api/snippets', async (req: Request, res: Response) => {
  try {
    const { title, code, language, description, tags } = req.body;
    
    if (!title || !code || !language) {
      return res.status(400).json({ error: 'Title, code, and language are required' });
    }
    
    const newSnippet: SnippetDocument = {
      _id: new ObjectId(),
      title,
      code,
      language,
      description: description || '',
      tags: tags || [],
      createdAt: new Date()
    };
    
    const result = await snippetsCollection.insertOne(newSnippet);
    
    const createdSnippet: Snippet = {
      id: result.insertedId.toString(),
      title: newSnippet.title,
      code: newSnippet.code,
      language: newSnippet.language,
      description: newSnippet.description,
      tags: newSnippet.tags,
      createdAt: newSnippet.createdAt.toISOString()
    };
    
    res.status(201).json(createdSnippet);
  } catch (error: any) {
    console.error('Error creating snippet:', error);
    res.status(500).json({ error: 'Failed to create snippet' });
  }
});

// Update snippet
app.put('/api/snippets/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, code, language, description, tags } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid snippet ID' });
    }
    
    if (!title || !code || !language) {
      return res.status(400).json({ error: 'Title, code, and language are required' });
    }
    
    const updateData = {
      title,
      code,
      language,
      description: description || '',
      tags: tags || [],
      updatedAt: new Date()
    };
    
    const result = await snippetsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Snippet not found' });
    }
    
    const updatedSnippet = await snippetsCollection.findOne({ _id: new ObjectId(id) });
    
    const formattedSnippet: Snippet = {
      id: updatedSnippet._id.toString(),
      title: updatedSnippet.title,
      code: updatedSnippet.code,
      language: updatedSnippet.language,
      description: updatedSnippet.description,
      tags: updatedSnippet.tags,
      createdAt: updatedSnippet.createdAt.toISOString()
    };
    
    res.json(formattedSnippet);
  } catch (error: any) {
    console.error('Error updating snippet:', error);
    res.status(500).json({ error: 'Failed to update snippet' });
  }
});

// Delete snippet
app.delete('/api/snippets/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid snippet ID' });
    }
    
    const result = await snippetsCollection.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Snippet not found' });
    }
    
    res.json({ message: 'Snippet deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting snippet:', error);
    res.status(500).json({ error: 'Failed to delete snippet' });
  }
});

// Search snippets
app.get('/api/snippets/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    
    const query = {
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { code: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ]
    };
    
    const snippets = await snippetsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    
    const formattedSnippets: Snippet[] = snippets.map((snippet: SnippetDocument) => ({
      id: snippet._id.toString(),
      title: snippet.title,
      code: snippet.code,
      language: snippet.language,
      description: snippet.description,
      tags: snippet.tags || [],
      createdAt: snippet.createdAt.toISOString()
    }));
    
    res.json(formattedSnippets);
  } catch (error: any) {
    console.error('Error searching snippets:', error);
    res.status(500).json({ error: 'Failed to search snippets' });
  }
});

// AI Analysis endpoint
app.post('/api/ai/analyze', async (req: Request, res: Response) => {
  try {
    const { code, language } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    // Get all snippets for analysis
    const snippets = await snippetsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    const formattedSnippets: Snippet[] = snippets.map((snippet: SnippetDocument) => ({
      id: snippet._id.toString(),
      title: snippet.title,
      code: snippet.code,
      language: snippet.language,
      description: snippet.description,
      tags: snippet.tags || [],
      createdAt: snippet.createdAt.toISOString()
    }));

    // Analyze similarity
    const suggestions = analyzeSimilarity(code, formattedSnippets);
    
    res.json({
      suggestions,
      analysis: {
        totalSnippets: snippets.length,
        relevantMatches: suggestions.length,
        language: detectLanguage(code)
      }
    });
  } catch (error: any) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Get all unique languages
app.get('/api/languages', async (req: Request, res: Response) => {
  try {
    const languages = await snippetsCollection.distinct('language');
    res.json(languages);
  } catch (error: any) {
    console.error('Error fetching languages:', error);
    res.status(500).json({ error: 'Failed to fetch languages' });
  }
});

// Get all unique tags
app.get('/api/tags', async (req: Request, res: Response) => {
  try {
    const tags = await snippetsCollection.distinct('tags');
    // Flatten and remove duplicates
    const uniqueTags = [...new Set(tags.flat())];
    res.json(uniqueTags);
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Similarity analysis functions
function analyzeSimilarity(currentCode: string, snippets: Snippet[]): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  
  for (const snippet of snippets) {
    const similarity = calculateSimilarity(currentCode, snippet.code);
    if (similarity > 0.3) {
      suggestions.push({
        snippet,
        reason: getSimilarityReason(similarity),
        confidence: similarity,
        context: getCodeContext(snippet.code, currentCode)
      });
    }
  }
  
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function calculateSimilarity(code1: string, code2: string): number {
  const tokens1 = tokenizeCode(code1);
  const tokens2 = tokenizeCode(code2);
  
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function tokenizeCode(code: string): string[] {
  return code
    .toLowerCase()
    .split(/[^\w]/)
    .filter(token => token.length > 2)
    .filter(token => !['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'import', 'export'].includes(token));
}

function getSimilarityReason(similarity: number): string {
  if (similarity > 0.7) return "Very similar implementation";
  if (similarity > 0.5) return "Similar logic and structure";
  if (similarity > 0.3) return "Related code patterns";
  return "Some common elements";
}

function getCodeContext(snippetCode: string, currentCode: string): string {
  const snippetTokens = new Set(tokenizeCode(snippetCode));
  const currentTokens = new Set(tokenizeCode(currentCode));
  
  const common = [...snippetTokens].filter(token => currentTokens.has(token));
  
  if (common.length > 0) {
    return `Common patterns: ${common.slice(0, 3).join(', ')}`;
  }
  
  return "Structural similarity detected";
}

function detectLanguage(code: string): string {
  if (code.includes('function') && code.includes('=>')) return 'javascript';
  if (code.includes('def ') && code.includes(':')) return 'python';
  if (code.includes('public class') || code.includes('void main')) return 'java';
  if (code.includes('#include') || code.includes('using namespace')) return 'cpp';
  if (code.includes('func ') && code.includes('package')) return 'go';
  if (code.includes('<?php')) return 'php';
  return 'unknown';
}

// Start server with better error handling
async function startServer() {
  try {
    await connectToDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Code Vault server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: MongoDB Atlas`);
      console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔧 CORS enabled for all origins`);
    });
  } catch (error: any) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await client.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await client.close();
  process.exit(0);
});

startServer().catch(console.error);