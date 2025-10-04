import React, { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Search, Plus, Moon, Sun, Code, Tag, Calendar, Brain, Sparkles, Zap, Copy, X } from 'lucide-react'
import './styles.css'

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://code-vault-desktop.onrender.com';

interface Snippet {
  id: string
  title: string
  code: string
  language: string
  tags: string[]
  createdAt: string
  description?: string
  similarity?: number
}

interface AISuggestion {
  snippet: Snippet
  reason: string
  confidence: number
  context: string
}

interface NewSnippet {
  title: string
  code: string
  language: string
  tags: string[]
  description: string
}

export default function App() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [filteredSnippets, setFilteredSnippets] = useState<Snippet[]>([])
  const [query, setQuery] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('all')
  const [selectedTag, setSelectedTag] = useState('all')
  const [isDark, setIsDark] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([])
  const [currentCode, setCurrentCode] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(true)
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [newSnippet, setNewSnippet] = useState<NewSnippet>({
    title: '',
    code: '',
    language: 'javascript',
    tags: [],
    description: ''
  })

  const languages = ['all', 'javascript', 'typescript', 'python', 'java', 'cpp', 'rust', 'go', 'html', 'css']
  const allTags = ['all', 'algorithm', 'utility', 'api', 'database', 'ui', 'authentication', 'auto-captured', 'vscode']

  useEffect(() => {
    checkBackendStatus()
    loadSnippets()
    const savedTheme = localStorage.getItem('theme')
    setIsDark(savedTheme === 'dark')
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  useEffect(() => {
    filterSnippets()
  }, [snippets, query, selectedLanguage, selectedTag])

  const checkBackendStatus = async () => {
    try {
      await axios.get(`${API_BASE_URL}/api/health`)
      setBackendStatus('online')
    } catch (error) {
      console.error('Backend is offline:', error)
      setBackendStatus('offline')
    }
  }

  const loadSnippets = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/snippets`)

      // Handle the actual response format from backend
      let snippetsData = res.data

      // If response is a string, try to parse it as JSON
      if (typeof snippetsData === 'string') {
        try {
          snippetsData = JSON.parse(snippetsData)
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', parseError)
        }
      }

      // Extract snippets array from the response
      if (Array.isArray(snippetsData)) {
        // Direct array response
        setSnippets(snippetsData)
      } else if (snippetsData && Array.isArray(snippetsData.data)) {
        // Nested in data property
        setSnippets(snippetsData.data)
      } else if (snippetsData && Array.isArray(snippetsData.snippets)) {
        // Nested in snippets property
        setSnippets(snippetsData.snippets)
      } else {
        // Try to find array in response object
        const arrayKey = Object.keys(snippetsData).find(key =>
          Array.isArray(snippetsData[key]) &&
          snippetsData[key].length > 0 &&
          snippetsData[key][0].id &&
          snippetsData[key][0].title
        )
        if (arrayKey) {
          setSnippets(snippetsData[arrayKey])
        } else {
          throw new Error('No snippets array found in response')
        }
      }

      setBackendStatus('online')
    } catch (error) {
      console.error('Failed to load snippets:', error)
      setBackendStatus('offline')

      // Load sample data for demo purposes
      setSnippets([
        {
          id: '1',
          title: 'React Hook Form Setup',
          code: 'const { register, handleSubmit, formState: { errors } } = useForm();\nconst onSubmit = data => console.log(data);',
          language: 'typescript',
          tags: ['react', 'form', 'hook'],
          createdAt: new Date().toISOString(),
          description: 'Basic setup for React Hook Form with TypeScript'
        },
        {
          id: '2',
          title: 'API Fetch Wrapper',
          code: 'async function apiFetch(url, options = {}) {\n  const response = await fetch(url, {\n    headers: { \'Content-Type\': \'application/json\' },\n    ...options\n  });\n  return response.json();\n}',
          language: 'javascript',
          tags: ['api', 'utility', 'http'],
          createdAt: new Date().toISOString(),
          description: 'Generic fetch wrapper for API calls'
        }
      ])
    }
  }

  const analyzeCodeWithAI = useCallback(async (code: string) => {
    if (!code.trim() || code.length < 20) {
      setAiSuggestions([])
      setShowAIPanel(false)
      return
    }

    setIsAnalyzing(true)
    try {
      if (backendStatus === 'online') {
        // Try server-side AI analysis first
        const response = await axios.post(`${API_BASE_URL}/api/ai/analyze`, {
          code,
          language: 'auto'
        })

        setAiSuggestions(response.data.suggestions || [])
        setShowAIPanel(true)
      } else {
        // Fallback to local similarity analysis
        performLocalAnalysis(code)
      }
    } catch (error) {
      console.error('AI analysis failed, using local analysis:', error)
      // Fallback to local similarity analysis
      performLocalAnalysis(code)
    } finally {
      setIsAnalyzing(false)
    }
  }, [snippets, backendStatus])

  const performLocalAnalysis = (code: string) => {
    const suggestions: AISuggestion[] = []

    snippets.forEach(snippet => {
      const similarity = calculateCodeSimilarity(code, snippet.code)
      if (similarity > 0.3) { // 30% similarity threshold
        suggestions.push({
          snippet,
          reason: getSimilarityReason(similarity),
          confidence: similarity,
          context: detectContext(snippet.code, code)
        })
      }
    })

    // Sort by confidence and take top 3
    suggestions.sort((a, b) => b.confidence - a.confidence)
    setAiSuggestions(suggestions.slice(0, 3))
    setShowAIPanel(suggestions.length > 0)
  }

  const calculateCodeSimilarity = (code1: string, code2: string): number => {
    // Tokenize code
    const tokens1 = tokenizeCode(code1)
    const tokens2 = tokenizeCode(code2)

    // Calculate Jaccard similarity
    const set1 = new Set(tokens1)
    const set2 = new Set(tokens2)

    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])

    return union.size === 0 ? 0 : intersection.size / union.size
  }

  const tokenizeCode = (code: string): string[] => {
    return code
      .toLowerCase()
      .split(/[^\w]/)
      .filter(token => token.length > 2 && !isCommonToken(token))
      .map(token => token.replace(/[0-9]/g, ''))
      .filter(token => token.length > 1)
  }

  const isCommonToken = (token: string): boolean => {
    const commonTokens = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'import', 'export', 'from']
    return commonTokens.includes(token)
  }

  const getSimilarityReason = (similarity: number): string => {
    if (similarity > 0.7) return "Very similar code structure and logic"
    if (similarity > 0.5) return "Similar implementation approach"
    if (similarity > 0.3) return "Related code patterns"
    return "Some common elements"
  }

  const detectContext = (snippetCode: string, currentCode: string): string => {
    const snippetTokens = tokenizeCode(snippetCode)
    const currentTokens = tokenizeCode(currentCode)

    const commonPatterns = snippetTokens.filter(token =>
      currentTokens.includes(token) && token.length > 3
    )

    if (commonPatterns.length > 0) {
      return `Uses similar patterns: ${commonPatterns.slice(0, 3).join(', ')}`
    }

    return "Similar coding style or structure"
  }

  const getAISuggestions = async () => {
    if (!currentCode.trim()) {
      alert('Please enter some code to analyze')
      return
    }
    await analyzeCodeWithAI(currentCode)
  }

  const insertSnippet = (snippet: Snippet) => {
    setCurrentCode(prev => prev + '\n\n' + snippet.code)
    setShowAIPanel(false)
  }

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    // You could add a toast notification here
  }

  const useSnippetAsTemplate = (snippet: Snippet) => {
    setCurrentCode(snippet.code)
    setShowAIPanel(false)
  }

  const filterSnippets = () => {
    let filtered = snippets

    if (query) {
      filtered = filtered.filter(snippet =>
        snippet.title.toLowerCase().includes(query.toLowerCase()) ||
        snippet.code.toLowerCase().includes(query.toLowerCase()) ||
        snippet.description?.toLowerCase().includes(query.toLowerCase()) ||
        snippet.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      )
    }

    if (selectedLanguage !== 'all') {
      filtered = filtered.filter(snippet => snippet.language === selectedLanguage)
    }

    if (selectedTag !== 'all') {
      filtered = filtered.filter(snippet => snippet.tags.includes(selectedTag))
    }

    setFilteredSnippets(filtered)
  }

  const addSnippet = async () => {
    try {
      const snippetToAdd = {
        ...newSnippet,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      }

      if (backendStatus === 'online') {
        const res = await axios.post(`${API_BASE_URL}/api/snippets`, snippetToAdd)
        setSnippets(prev => [...prev, res.data])
      } else {
        // Add locally if backend is offline
        setSnippets(prev => [...prev, snippetToAdd])
      }

      setShowAddForm(false)
      setNewSnippet({
        title: '',
        code: '',
        language: 'javascript',
        tags: [],
        description: ''
      })
    } catch (error) {
      console.error('Failed to add snippet:', error)
      alert('Backend is unavailable. Snippet saved locally only.')

      // Fallback: save locally
      const snippetToAdd = {
        ...newSnippet,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      }
      setSnippets(prev => [...prev, snippetToAdd])
      setShowAddForm(false)
      setNewSnippet({
        title: '',
        code: '',
        language: 'javascript',
        tags: [],
        description: ''
      })
    }
  }

  const handleTagToggle = (tag: string) => {
    setNewSnippet(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }))
  }

  const clearAIAnalysis = () => {
    setCurrentCode('')
    setAiSuggestions([])
    setShowAIPanel(false)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Code size={24} />
            <h1>Code Vault</h1>
            <span className="ai-badge">AI Powered</span>
          </div>
          <div className="header-actions">
            <div className="backend-status">
              <div className={`status-indicator ${backendStatus}`}>
                {backendStatus === 'online' && '🟢 Backend Online'}
                {backendStatus === 'offline' && '🔴 Backend Offline'}
                {backendStatus === 'checking' && '🟡 Checking...'}
              </div>
            </div>
            <button
              className="icon-btn"
              onClick={() => setIsDark(!isDark)}
              title="Toggle theme"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              className="btn primary"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={16} />
              Add Snippet
            </button>
          </div>
        </div>
      </header>

      {/* Backend Status Warning */}
      {backendStatus === 'offline' && (
        <div className="offline-warning">
          <p>⚠️ Backend server is offline. Snippets are stored locally only and will not be saved to the cloud.</p>
        </div>
      )}

      <main className="main-content">
        {/* AI Analysis Panel */}
        <div className="ai-panel">
          <div className="ai-header">
            <Brain size={20} />
            <h3>AI Code Assistant</h3>
            <Sparkles size={16} className="sparkle" />
            {currentCode && (
              <button
                className="icon-btn clear-btn"
                onClick={clearAIAnalysis}
                title="Clear analysis"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="code-input-section">
            <textarea
              value={currentCode}
              onChange={(e) => setCurrentCode(e.target.value)}
              placeholder="Paste your current code here for AI analysis and suggestions..."
              rows={6}
              className="code-input"
            />
            <div className="analysis-actions">
              <button
                onClick={getAISuggestions}
                disabled={isAnalyzing || !currentCode.trim()}
                className="btn primary analyze-btn"
              >
                {isAnalyzing ? (
                  <>Analyzing...</>
                ) : (
                  <>
                    <Zap size={16} />
                    Analyze with AI
                  </>
                )}
              </button>
              {currentCode && (
                <button
                  onClick={() => copyToClipboard(currentCode)}
                  className="btn secondary"
                >
                  <Copy size={16} />
                  Copy Code
                </button>
              )}
            </div>
          </div>

          {/* AI Suggestions */}
          {showAIPanel && aiSuggestions.length > 0 && (
            <div className="suggestions-panel">
              <h4>🤖 AI Found Similar Code in Your Vault</h4>
              <div className="suggestions-list">
                {aiSuggestions.map((suggestion, index) => (
                  <div key={index} className="suggestion-card">
                    <div className="suggestion-header">
                      <span className="snippet-title">{suggestion.snippet.title}</span>
                      <span className="confidence-badge">
                        {Math.round(suggestion.confidence * 100)}% match
                      </span>
                    </div>
                    <p className="suggestion-reason">{suggestion.reason}</p>
                    <p className="suggestion-context">{suggestion.context}</p>
                    <div className="snippet-preview">
                      <pre className="suggestion-code">
                        <code>{suggestion.snippet.code.slice(0, 200)}...</code>
                      </pre>
                    </div>
                    <div className="suggestion-actions">
                      <button
                        onClick={() => insertSnippet(suggestion.snippet)}
                        className="btn primary small"
                      >
                        Insert Below
                      </button>
                      <button
                        onClick={() => useSnippetAsTemplate(suggestion.snippet)}
                        className="btn secondary small"
                      >
                        Use as Template
                      </button>
                      <button
                        onClick={() => copyToClipboard(suggestion.snippet.code)}
                        className="btn secondary small"
                      >
                        <Copy size={14} />
                        Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showAIPanel && aiSuggestions.length === 0 && currentCode.length > 20 && (
            <div className="no-suggestions">
              <p>✨ No similar code found in your vault. This might be new code pattern!</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="btn primary small"
              >
                <Plus size={14} />
                Add to Vault
              </button>
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <div className="filters-section">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search snippets by title, code, or tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="filter-controls">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              {languages.map(lang => (
                <option key={lang} value={lang}>
                  {lang === 'all' ? 'All Languages' : lang}
                </option>
              ))}
            </select>

            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              {allTags.map(tag => (
                <option key={tag} value={tag}>
                  {tag === 'all' ? 'All Tags' : tag}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Snippets Grid */}
        <div className="snippets-grid">
          {filteredSnippets.map(snippet => (
            <div key={snippet.id} className="snippet-card">
              <div className="snippet-header">
                <h3>{snippet.title}</h3>
                <span className="language-badge">{snippet.language}</span>
              </div>

              {snippet.description && (
                <p className="snippet-description">{snippet.description}</p>
              )}

              <pre className="snippet-code">
                <code>{snippet.code}</code>
              </pre>

              <div className="snippet-footer">
                <div className="tags">
                  {snippet.tags.map(tag => (
                    <span key={tag} className="tag">
                      <Tag size={12} />
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="snippet-date">
                  <Calendar size={12} />
                  {new Date(snippet.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="snippet-actions">
                <button
                  onClick={() => copyToClipboard(snippet.code)}
                  className="btn secondary small"
                >
                  <Copy size={14} />
                  Copy
                </button>
                <button
                  onClick={() => {
                    setCurrentCode(snippet.code)
                    analyzeCodeWithAI(snippet.code)
                  }}
                  className="btn secondary small"
                >
                  <Brain size={14} />
                  Analyze
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredSnippets.length === 0 && snippets.length > 0 && (
          <div className="empty-state">
            <Search size={48} />
            <h3>No snippets found</h3>
            <p>Try adjusting your search criteria</p>
          </div>
        )}

        {snippets.length === 0 && (
          <div className="empty-state">
            <Code size={48} />
            <h3>Your Code Vault is empty</h3>
            <p>Add your first code snippet to get started!</p>
            <button
              className="btn primary"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={16} />
              Add First Snippet
            </button>
          </div>
        )}
      </main>

      {/* Add Snippet Modal */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Add New Snippet</h2>

            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                value={newSnippet.title}
                onChange={(e) => setNewSnippet(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter snippet title"
                required
              />
            </div>

            <div className="form-group">
              <label>Language *</label>
              <select
                value={newSnippet.language}
                onChange={(e) => setNewSnippet(prev => ({ ...prev, language: e.target.value }))}
              >
                {languages.filter(lang => lang !== 'all').map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Code *</label>
              <textarea
                value={newSnippet.code}
                onChange={(e) => setNewSnippet(prev => ({ ...prev, code: e.target.value }))}
                placeholder="Paste your code here..."
                rows={8}
                required
              />
            </div>

            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                value={newSnippet.description}
                onChange={(e) => setNewSnippet(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this code does..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Tags</label>
              <div className="tags-input">
                {allTags.filter(tag => tag !== 'all').map(tag => (
                  <label key={tag} className="tag-option">
                    <input
                      type="checkbox"
                      checked={newSnippet.tags.includes(tag)}
                      onChange={() => handleTagToggle(tag)}
                    />
                    {tag}
                  </label>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={addSnippet}
                disabled={!newSnippet.title.trim() || !newSnippet.code.trim()}
              >
                Save Snippet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}