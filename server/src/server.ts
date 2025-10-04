import express, { Request, Response } from 'express';
import cors from 'cors';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 8802;

// MongoDB Atlas connection - use environment variable in production
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kafuiakakpo1_db_user:EbkL3KWwU739hPIz@cluster0.wlxpplo.mongodb.net/codevault?retryWrites=true&w=majority';

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
    
    // Create indexes for better performance
    await snippetsCollection.createIndex({ title: 'text', code: 'text', description: 'text' });
    await snippetsCollection.createIndex({ language: 1 });
    await snippetsCollection.createIndex({ tags: 1 });
    await snippetsCollection.createIndex({ createdAt: -1 });
    
    // Insert sample data if collection is empty
    const snippetCount = await snippetsCollection.countDocuments();
    if (snippetCount === 0) {
      await insertSampleData();
    }
  } catch (error: any) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('💡 Make sure your MongoDB Atlas IP whitelist includes Render IPs');
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

// Middleware
app.use(cors({
  origin: [
    'https://code-vault-desktop.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true
}));
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

// ... include all your other routes from the previous version

// Start server with better error handling
async function startServer() {
  try {
    await connectToDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Code Vault server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: MongoDB Atlas`);
      console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
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