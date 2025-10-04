import * as vscode from 'vscode';
import axios from 'axios';

interface Snippet {
  id: string;
  title: string;
  code: string;
  language: string;
  tags: string[];
  description?: string;
  createdAt: string;
}

// Store recently processed code to avoid duplicates
const recentlyProcessed = new Set<string>();
let existingSnippetsCache: Snippet[] = [];
let isExtensionActive = false;
let lastSaveTime = 0;

export function activate(context: vscode.ExtensionContext) {
  console.log('🎯 Code Vault extension activating...');
  isExtensionActive = true;

  const config = vscode.workspace.getConfiguration('codeVault');
  const serverUrl = config.get('serverUrl', 'http://code-vault-desktop.onrender.com');
  const autoCapture = config.get('autoCapture', true);
  const captureOnSave = config.get('captureOnSave', true);

  console.log(`🔧 Extension configuration:`, {
    serverUrl,
    autoCapture,
    captureOnSave,
    isExtensionActive
  });

  // Preload existing snippets for duplicate checking
  loadExistingSnippets(serverUrl);

  // Test server connection on activation
  testServerConnection(serverUrl);

  // Register commands
  let showSnippetsCommand = vscode.commands.registerCommand('codeVault.showSnippets', async () => {
    console.log('📝 Code Vault: Show snippets command triggered');
    await showRelevantSnippets(serverUrl);
  });

  let captureCodeCommand = vscode.commands.registerCommand('codeVault.captureCode', async () => {
    console.log('💾 Code Vault: Capture code command triggered');
    await captureCurrentCode(serverUrl);
  });

  let statusCommand = vscode.commands.registerCommand('codeVault.checkStatus', async () => {
    await checkExtensionStatus(serverUrl);
  });

  let refreshCacheCommand = vscode.commands.registerCommand('codeVault.refreshCache', async () => {
    await loadExistingSnippets(serverUrl);
    vscode.window.showInformationMessage('✅ Code Vault: Snippet cache refreshed');
  });

  // Monitor editor for automatic code capture (only for selections)
  let lastCaptureTime = 0;
  const captureCooldown = 30000; // 30 seconds between auto-captures

  const editorChangeDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (!autoCapture || !isExtensionActive) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || event.document !== editor.document) {
      return;
    }

    // Skip if we just saved the file (to avoid double capture)
    const now = Date.now();
    if (now - lastSaveTime < 2000) { // 2 second cooldown after save
      return;
    }

    // Throttle captures
    if (now - lastCaptureTime < captureCooldown) {
      return;
    }

    // Only capture selections, not general typing
    if (!editor.selection.isEmpty) {
      console.log('🔍 Code Vault: Selection capture triggered');
      await captureSelectionOnly(editor, serverUrl);
      lastCaptureTime = Date.now();
    }
  });

  // Monitor file saves for code capture (only capture entire files here)
  const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
    if (!autoCapture || !captureOnSave || !isExtensionActive) return;

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document === document) {
      console.log('💾 Code Vault: File save capture triggered');
      lastSaveTime = Date.now();
      await captureEntireFile(editor, serverUrl);
    }
  });

  context.subscriptions.push(
    showSnippetsCommand,
    captureCodeCommand,
    statusCommand,
    refreshCacheCommand,
    editorChangeDisposable,
    saveDisposable
  );

  console.log('✅ Code Vault extension activated successfully!');
}

export function deactivate() {
  console.log('🔴 Code Vault extension deactivated');
  isExtensionActive = false;
}

async function captureSelectionOnly(editor: vscode.TextEditor, serverUrl: string) {
  try {
    const document = editor.document;
    const selection = editor.selection;
    
    // Only capture if there's a selection
    if (selection.isEmpty) {
      return;
    }

    const codeToCapture = document.getText(selection);
    const title = `Selection - ${getFileName(document)}`;
    
    console.log('📝 Capturing selected code:', { length: codeToCapture.length });

    if (codeToCapture && codeToCapture.length > 20) {
      await processCodeCapture(codeToCapture, document.languageId, title, serverUrl, false);
    }
  } catch (error) {
    console.error('❌ Selection capture error:', error);
  }
}

async function captureEntireFile(editor: vscode.TextEditor, serverUrl: string) {
  try {
    const document = editor.document;
    const codeToCapture = document.getText();
    const title = `File: ${getFileName(document)}`;
    
    console.log('💾 Capturing entire file:', { length: codeToCapture.length });

    // Only capture substantial files
    if (codeToCapture && codeToCapture.length > 100) {
      await processCodeCapture(codeToCapture, document.languageId, title, serverUrl, true);
    }
  } catch (error) {
    console.error('❌ File capture error:', error);
  }
}

async function processCodeCapture(code: string, language: string, title: string, serverUrl: string, isFile: boolean = false) {
  // Check if this code already exists
  const isDuplicate = await isCodeAlreadyInVault(code, serverUrl);
  if (isDuplicate) {
    console.log('⏭️ Skip capture - code already exists in vault');
    return;
  }

  if (!isDuplicateCode(code)) {
    await saveSnippetToVault(code, language, title, serverUrl);
    
    if (isFile) {
      vscode.window.showInformationMessage(`💾 Code Vault: Captured file ${getFileNameFromTitle(title)}`);
    }
  } else {
    console.log('⏭️ Skip capture - duplicate code (recently processed)');
  }
}

async function loadExistingSnippets(serverUrl: string): Promise<void> {
  try {
    const response = await axios.get(`${serverUrl}/api/snippets`, { timeout: 10000 });
    existingSnippetsCache = response.data;
    console.log(`📚 Loaded ${existingSnippetsCache.length} existing snippets into cache`);
  } catch (error) {
    console.error('❌ Failed to load existing snippets:', error);
    // Don't show error to user here - it might just be that the app isn't running yet
  }
}

async function testServerConnection(serverUrl: string) {
  try {
    const response = await axios.get(`${serverUrl}/api/health`, { timeout: 5000 });
    console.log('✅ Connected to Code Vault desktop app:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Cannot connect to Code Vault desktop app:', error);
    vscode.window.showErrorMessage(
      `Code Vault: Cannot connect to desktop app at ${serverUrl}. ` +
      `Make sure the Code Vault desktop app is running. ` +
      `If using a different port, update the "codeVault.serverUrl" setting in VS Code settings.`
    );
    return false;
  }
}

async function checkExtensionStatus(serverUrl: string) {
  const serverReachable = await testServerConnection(serverUrl);
  const status = {
    extensionActive: isExtensionActive,
    serverUrl,
    serverReachable,
    cachedSnippets: existingSnippetsCache.length,
    recentlyProcessed: recentlyProcessed.size,
    commands: ['codeVault.showSnippets', 'codeVault.captureCode', 'codeVault.checkStatus', 'codeVault.refreshCache']
  };

  console.log('🔧 Extension Status:', status);
  
  if (serverReachable) {
    vscode.window.showInformationMessage(
      `✅ Code Vault: Connected to desktop app, ${existingSnippetsCache.length} snippets cached`
    );
  } else {
    vscode.window.showWarningMessage(
      `❌ Code Vault: Desktop app not found at ${serverUrl}. Make sure the Code Vault app is running.`
    );
  }
}

async function isCodeAlreadyInVault(code: string, serverUrl: string): Promise<boolean> {
  try {
    // First check cache for quick comparison
    const codeHash = generateCodeHash(code);
    
    for (const snippet of existingSnippetsCache) {
      const snippetHash = generateCodeHash(snippet.code);
      if (codeHash === snippetHash) {
        console.log('🔍 Found exact match in cache:', snippet.title);
        return true;
      }
      
      // Also check for high similarity
      const similarity = calculateCodeSimilarity(code, snippet.code);
      if (similarity > 0.8) { // 80% similarity threshold
        console.log('🔍 Found highly similar code in cache:', snippet.title, `${Math.round(similarity * 100)}%`);
        return true;
      }
    }

    // If not found in cache, do a more thorough check with the server
    try {
      const response = await axios.post(`${serverUrl}/api/ai/analyze`, {
        code,
        language: 'auto'
      }, { timeout: 10000 });

      // If server finds very similar code, consider it a duplicate
      const suggestions = response.data.suggestions || [];
      const highlySimilar = suggestions.some((s: any) => s.confidence > 0.8);
      
      if (highlySimilar) {
        console.log('🔍 Server found highly similar code, skipping capture');
        return true;
      }
    } catch (serverError) {
      console.log('🔍 Server AI check failed, using cache only');
    }

    return false;
  } catch (error) {
    console.error('❌ Duplicate check failed, proceeding with capture:', error);
    return false; // If check fails, allow capture
  }
}

function calculateCodeSimilarity(code1: string, code2: string): number {
  // Simple similarity calculation based on code structure
  const normalizeCode = (code: string): string => {
    return code
      .toLowerCase()
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/"([^"\\]|\\.)*"/g, '""') // Normalize strings
      .replace(/'([^'\\]|\\.)*'/g, "''") // Normalize strings
      .replace(/\b\d+\b/g, '0') // Normalize numbers
      .trim();
  };

  const normalized1 = normalizeCode(code1);
  const normalized2 = normalizeCode(code2);

  // Calculate similarity based on common lines
  const lines1 = new Set(normalized1.split('\n').filter(line => line.length > 5));
  const lines2 = new Set(normalized2.split('\n').filter(line => line.length > 5));

  const intersection = new Set([...lines1].filter(line => lines2.has(line)));
  const union = new Set([...lines1, ...lines2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

function generateCodeHash(code: string): string {
  // Create a normalized hash that ignores whitespace and comments
  const normalized = code
    .toLowerCase()
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, '')
    .replace(/"([^"\\]|\\.)*"/g, '""')
    .replace(/'([^'\\]|\\.)*'/g, "''")
    .replace(/\b\d+\b/g, '0');

  return simpleHash(normalized);
}

async function captureCurrentCode(serverUrl: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor found');
    return;
  }

  console.log('🎯 Manual capture initiated');

  const document = editor.document;
  const selection = editor.selection;
  
  let codeToCapture = '';
  let defaultTitle = '';

  if (!selection.isEmpty) {
    codeToCapture = document.getText(selection);
    defaultTitle = `Selection from ${getFileName(document)}`;
    console.log('📝 Capturing selection:', { length: codeToCapture.length });
  } else {
    // For manual capture without selection, capture the entire file
    codeToCapture = document.getText();
    defaultTitle = `File: ${getFileName(document)}`;
    console.log('📝 Capturing entire file manually:', { length: codeToCapture.length });
  }

  // Check if code already exists
  const isDuplicate = await isCodeAlreadyInVault(codeToCapture, serverUrl);
  if (isDuplicate) {
    vscode.window.showWarningMessage('📝 This code already exists in your Code Vault!');
    return;
  }

  // Ask user for title and description
  const title = await vscode.window.showInputBox({
    placeHolder: 'Enter a title for this code snippet',
    prompt: 'Code Snippet Title',
    value: defaultTitle
  });

  if (!title) {
    console.log('⏹️ Capture cancelled - no title provided');
    return;
  }

  const description = await vscode.window.showInputBox({
    placeHolder: 'Optional description of what this code does',
    prompt: 'Code Description (optional)'
  });

  console.log('📝 Final snippet data:', {
    title,
    description,
    language: document.languageId,
    codeLength: codeToCapture.length
  });

  await saveSnippetToVault(codeToCapture, document.languageId, title, serverUrl, description);
}

async function saveSnippetToVault(code: string, language: string, title: string, serverUrl: string, description?: string) {
  try {
    console.log('💾 Saving snippet to vault...');
    
    // Create a fingerprint to avoid immediate duplicates
    const codeHash = generateCodeHash(code);
    if (isDuplicateCode(codeHash)) {
      console.log('⏭️ Skip save - duplicate code (recently processed)');
      vscode.window.showWarningMessage('📝 This code was recently captured!');
      return;
    }

    // Add to recently processed to avoid immediate duplicates
    recentlyProcessed.add(codeHash);
    setTimeout(() => recentlyProcessed.delete(codeHash), 60000); // Remove after 1 minute

    // Create the snippet data exactly as the backend expects it
    const snippetData = {
      title: title || `Code from ${new Date().toLocaleString()}`,
      code: code,
      language: mapLanguageId(language),
      description: description || '',
      tags: ['auto-captured', 'vscode']
      // Don't include id or createdAt - let the backend handle this
    };

    console.log('📤 Sending snippet to desktop app:', { 
      title: snippetData.title, 
      language: snippetData.language, 
      length: code.length 
    });
    
    const response = await axios.post(`${serverUrl}/api/snippets`, snippetData, { 
      timeout: 10000 
    });
    
    // Update cache with new snippet
    if (response.data && response.data.id) {
      existingSnippetsCache.unshift(response.data);
      console.log('✅ Snippet saved successfully to desktop app:', response.data.id);
      vscode.window.showInformationMessage(`💾 Code Vault: "${title}" saved successfully!`);
    } else {
      console.error('❌ Invalid response from server:', response.data);
      vscode.window.showErrorMessage('Failed to save snippet - invalid server response');
    }
    
  } catch (error: any) {
    console.error('❌ Failed to save snippet to Code Vault:', error);
    
    // Show more detailed error message
    if (error.response) {
      // Server responded with error status
      console.error('Server error response:', error.response.data);
      vscode.window.showErrorMessage(
        `Failed to save code: ${error.response.data.error || 'Server error'}`
      );
    } else if (error.request) {
      // No response received
      vscode.window.showErrorMessage(
        `Cannot connect to Code Vault desktop app at ${serverUrl}. Make sure it's running.`
      );
    } else {
      // Other error
      vscode.window.showErrorMessage(
        `Failed to save code: ${error.message}`
      );
    }
  }
}

function isDuplicateCode(codeOrHash: string): boolean {
  return recentlyProcessed.has(codeOrHash);
}

async function showRelevantSnippets(serverUrl: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor found');
    return;
  }

  console.log('🔍 Looking for relevant snippets...');

  const currentText = editor.document.getText();
  const currentLanguage = editor.document.languageId;

  try {
    // Use cached snippets for faster response
    const snippets = existingSnippetsCache;

    console.log(`📚 Found ${snippets.length} total snippets in cache`);

    // Filter snippets by current language and content relevance
    const relevantSnippets = snippets.filter(snippet => 
      snippet.language === mapLanguageId(currentLanguage) || 
      isCodeSimilar(snippet.code, currentText)
    );

    console.log(`🎯 Found ${relevantSnippets.length} relevant snippets`);

    if (relevantSnippets.length === 0) {
      vscode.window.showInformationMessage('No relevant snippets found in your Code Vault');
      return;
    }

    // Show snippet picker
    const snippetItems = relevantSnippets.map(snippet => ({
      label: snippet.title,
      description: snippet.language,
      detail: snippet.description || snippet.code.slice(0, 100) + '...',
      snippet
    }));

    const selected = await vscode.window.showQuickPick(snippetItems, {
      placeHolder: 'Select a snippet to insert'
    });

    if (selected) {
      // Insert the selected snippet at cursor position
      const snippetText = selected.snippet.code;
      const position = editor.selection.active;
      
      await editor.edit(editBuilder => {
        editBuilder.insert(position, snippetText);
      });

      console.log('✅ Snippet inserted:', selected.snippet.title);
      vscode.window.showInformationMessage(`📝 Inserted: ${selected.snippet.title}`);
    } else {
      console.log('⏹️ No snippet selected');
    }

  } catch (error) {
    console.error('❌ Code Vault connection error:', error);
    vscode.window.showErrorMessage(
      'Failed to connect to Code Vault. Make sure the desktop app is running.'
    );
  }
}

// Helper functions
function getFileName(document: vscode.TextDocument): string {
  return document.fileName.split('/').pop()?.split('\\').pop() || 'untitled';
}

function getFileNameFromTitle(title: string): string {
  return title.replace('File: ', '').replace('Selection - ', '');
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function mapLanguageId(languageId: string): string {
  const languageMap: { [key: string]: string } = {
    'javascript': 'javascript',
    'typescript': 'typescript',
    'javascriptreact': 'javascript',
    'typescriptreact': 'typescript',
    'python': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'csharp': 'csharp',
    'php': 'php',
    'ruby': 'ruby',
    'go': 'go',
    'rust': 'rust',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'markdown': 'markdown',
    'sql': 'sql',
    'shellscript': 'shell'
  };
  
  return languageMap[languageId] || languageId;
}

function isCodeSimilar(code1: string, code2: string): boolean {
  const tokens1 = code1.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  const tokens2 = code2.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  
  const commonTokens = tokens1.filter(token => tokens2.includes(token));
  return commonTokens.length > 3;
}