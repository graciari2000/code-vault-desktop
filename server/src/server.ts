import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';
// Add these imports at the top
import { createHash } from 'crypto';

const app = express();
const PORT = 8802;

app.use(cors());
app.use(express.json());

// Database setup
const db = new Database('code-vault.db');

// Define types
interface SnippetRow {
  id: string;
  title: string;
  code: string;
  language: string;
  description: string | null;
  tags: string | null;
  created_at: string;
}

interface Snippet {
  id: string;
  title: string;
  code: string;
  language: string;
  description?: string;
  tags: string[];
  createdAt: string;
}

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS snippets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    description TEXT,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert sample data if empty
const snippetCount = db.prepare('SELECT COUNT(*) as count FROM snippets').get() as { count: number };
if (snippetCount.count === 0) {
  const insertSnippet = db.prepare(`
    INSERT INTO snippets (id, title, code, language, description, tags)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const sampleSnippets = [
    {
      id: uuidv4(),
      title: 'React Hook Form Setup',
      code: `const { register, handleSubmit, formState: { errors } } = useForm();\nconst onSubmit = data => console.log(data);`,
      language: 'typescript',
      description: 'Basic setup for React Hook Form with TypeScript',
      tags: JSON.stringify(['react', 'form', 'hook'])
    },
    {
      id: uuidv4(),
      title: 'API Fetch Wrapper',
      code: `async function apiFetch(url, options = {}) {\n  const response = await fetch(url, {\n    headers: { 'Content-Type': 'application/json' },\n    ...options\n  });\n  return response.json();\n}`,
      language: 'javascript',
      description: 'Generic fetch wrapper for API calls',
      tags: JSON.stringify(['api', 'utility', 'http'])
    }
  ];

  sampleSnippets.forEach(snippet => {
    insertSnippet.run(
      snippet.id,
      snippet.title,
      snippet.code,
      snippet.language,
      snippet.description,
      snippet.tags
    );
  });
}

// Routes
app.get('/api/snippets', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM snippets ORDER BY created_at DESC').all() as SnippetRow[];
    
    const snippets: Snippet[] = rows.map(row => ({
      id: row.id,
      title: row.title,
      code: row.code,
      language: row.language,
      description: row.description || undefined,
      tags: row.tags ? JSON.parse(row.tags) : [],
      createdAt: row.created_at
    }));
    
    res.json(snippets);
  } catch (error) {
    console.error('Error fetching snippets:', error);
    res.status(500).json({ error: 'Failed to fetch snippets' });
  }
});

app.post('/api/snippets', (req, res) => {
  try {
    const { title, code, language, description, tags } = req.body;
    const id = uuidv4();
    
    const insertStmt = db.prepare(`
      INSERT INTO snippets (id, title, code, language, description, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    insertStmt.run(
      id,
      title,
      code,
      language,
      description || null,
      JSON.stringify(tags || [])
    );
    
    const snippet: Snippet = {
      id,
      title,
      code,
      language,
      description,
      tags: tags || [],
      createdAt: new Date().toISOString()
    };
    
    res.json(snippet);
  } catch (error) {
    console.error('Error creating snippet:', error);
    res.status(500).json({ error: 'Failed to create snippet' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Code Vault server is running' });
});

// Search endpoint
app.get('/api/snippets/search', (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const searchStmt = db.prepare(`
      SELECT * FROM snippets 
      WHERE title LIKE ? OR code LIKE ? OR description LIKE ? OR tags LIKE ?
      ORDER BY created_at DESC
    `);
    
    const searchTerm = `%${q}%`;
    const rows = searchStmt.all(searchTerm, searchTerm, searchTerm, searchTerm) as SnippetRow[];
    
    const snippets: Snippet[] = rows.map(row => ({
      id: row.id,
      title: row.title,
      code: row.code,
      language: row.language,
      description: row.description || undefined,
      tags: row.tags ? JSON.parse(row.tags) : [],
      createdAt: row.created_at
    }));
    
    res.json(snippets);
  } catch (error) {
    console.error('Error searching snippets:', error);
    res.status(500).json({ error: 'Failed to search snippets' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Code Vault server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💾 Database: code-vault.db`);
});

// Add AI analysis endpoint
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { code, language } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    // Get all snippets for analysis
    const rows = db.prepare('SELECT * FROM snippets ORDER BY created_at DESC').all() as SnippetRow[];
    const snippets: Snippet[] = rows.map(row => ({
      id: row.id,
      title: row.title,
      code: row.code,
      language: row.language,
      description: row.description || undefined,
      tags: row.tags ? JSON.parse(row.tags) : [],
      createdAt: row.created_at
    }));

    // Analyze similarity
    const suggestions = analyzeSimilarity(code, snippets);
    
    res.json({
      suggestions,
      analysis: {
        totalSnippets: snippets.length,
        relevantMatches: suggestions.length,
        language: detectLanguage(code)
      }
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Similarity analysis function
function analyzeSimilarity(currentCode: string, snippets: Snippet[]): any[] {
  const suggestions = [];
  
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
    .filter(token => !['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return'].includes(token));
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
  return 'unknown';
}