# Code Vault VS Code Extension 
🚀 AI-powered code snippet manager that automatically captures and suggests relevant code from your personal library

## Overview
Code Vault is an intelligent VS Code extension that helps you build a personal library of code snippets. It automatically captures your code as you work and uses AI to suggest relevant snippets when you need them most.

![Demo](https://via.placeholder.com/800x400/2D3748/FFFFFF?text=Code+Vault+Demo)

## Features
### 🤖 Smart Code Capture
- Auto-capture selections: Automatically saves code you select (with cooldown)
- File save capture: Captures entire files when you save them
- Manual capture: Use commands to capture specific code snippets
- Duplicate detection: Prevents saving duplicate or highly similar code

### 🔍 Intelligent Search & Suggestions
- Relevant snippets: Shows code snippets relevant to your current file
- AI-powered matching: Finds similar code patterns using smart algorithms
- Quick insertion: Insert snippets directly into your code with one click

### ⚡ Seamless Integration
- Keyboard shortcuts: Ctrl+Shift+V (show snippets) and Ctrl+Shift+C (capture code)
- Context menus: Right-click in editor to access Code Vault features
- Status checking: Verify connection to your Code Vault desktop app

## Installation
### Prerequisites
- Code Vault Desktop App must be running
- VS Code 1.74.0 or higher

### Setup Steps
**Install the Extension**
```bash
# Install from VS Code Marketplace
# Or load from VSIX: Extensions → ... → Install from VSIX
```
**Configure Server URL**
1. Open VS Code Settings (Ctrl+,)
2. Search for "Code Vault"
3. Set "Server Url" to your backend:
   - Local: http://localhost:8802
   - Render: https://code-vault-desktop.onrender.com

**Start Desktop App**
Ensure your Code Vault desktop application is running.  
The extension connects to this backend to store and retrieve snippets.

## Usage
### Basic Commands
| Command | Shortcut | Description |
|---------|----------|-------------|
| Code Vault: Show Relevant Snippets | Ctrl+Shift+V | View snippets relevant to current file |
| Code Vault: Capture Current Code | Ctrl+Shift+C | Manually capture selected code or entire file |
| Code Vault: Check Extension Status | - | Verify connection and view stats |
| Code Vault: Refresh Snippet Cache | - | Reload snippets from server |

### Automatic Capture
- Selection Capture: When you select code and pause for a moment
- File Save Capture: When you save a file (entire file capture)

### Manual Capture
1. Select code or place cursor in file
2. Use Ctrl+Shift+C or command palette
3. Enter title and optional description
4. Snippet is saved to your personal vault

### Finding Relevant Code
1. Use Ctrl+Shift+V in any file
2. Browse suggestions filtered by language and content
3. Click any snippet to insert it at cursor position

## Configuration
### Extension Settings
```json
{
  "codeVault.serverUrl": "https://code-vault-desktop.onrender.com",
  "codeVault.autoCapture": true,
  "codeVault.captureOnSave": true,
  "codeVault.autoSuggest": true
}
```

### Settings Explanation
- **serverUrl**: URL of your Code Vault backend (local or deployed)
- **autoCapture**: Enable/disable automatic code capture
- **captureOnSave**: Capture entire files on save
- **autoSuggest**: Show automatic snippet suggestions (future feature)

## Architecture
### How It Works
```
VS Code Extension → HTTP API → Desktop App → MongoDB
       ↑
   Snippet Cache
```
- Extension: Captures code and manages UI
- Desktop App: Backend server with REST API
- MongoDB: Cloud database for snippet storage
- AI Analysis: Server-side code similarity detection

### Data Flow
1. Code captured in VS Code
2. Sent to desktop app via POST /api/snippets
3. Stored in MongoDB with metadata
4. Retrieved via GET /api/snippets for suggestions
5. AI analysis via POST /api/ai/analyze for similarity

## Troubleshooting
### Common Issues
❌ "Cannot connect to desktop app"  
- Ensure desktop app is running  
- Check server URL in settings  
- Verify port 8802 is accessible  

❌ Snippets not saving  
- Check extension output panel for errors  
- Verify MongoDB connection in desktop app  
- Check CORS configuration  

❌ No suggestions appearing  
- Refresh snippet cache with status command  
- Check if you have snippets in similar languages  
- Verify AI analysis endpoint is working  

### Debugging
- **Check Extension Logs**: View → Output → Select "Code Vault"
- **Test Connection**: Run Code Vault: Check Extension Status
- **Manual Testing**:
```bash
curl https://code-vault-desktop.onrender.com/api/health
```

## Development
### Building from Source
```bash
# Clone the repository
git clone https://github.com/graciari2000/code-vault-desktop
cd vscode-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package extension
npm run package
```

### Project Structure
```
src/
├── extension.ts          # Main extension code
├── test/                 # Test files
package.json              # Extension manifest
tsconfig.json             # TypeScript configuration
```

### Key Components
- Snippet Interface: TypeScript interfaces for code snippets
- Capture Logic: Automatic and manual code capture
- Similarity Engine: Code comparison algorithms
- API Client: HTTP communication with backend

## API Reference
### Snippet Object
```typescript
interface Snippet {
  id: string;
  title: string;
  code: string;
  language: string;
  tags: string[];
  description?: string;
  createdAt: string;
}
```

### Endpoints
- `GET /api/health` - Server status
- `GET /api/snippets` - List all snippets
- `POST /api/snippets` - Create new snippet
- `POST /api/ai/analyze` - AI code analysis

## Support
### Getting Help
- Documentation: GitHub Wiki
- Issues: GitHub Issues
- Email: graciari2000@gmail.com

## System Requirements
- VS Code: ^1.74.0
- Node.js: 16.x or higher
- Code Vault Desktop App: v0.2.0 or higher

## Release Notes
### v0.2.0
✅ Fixed MongoDB connection issues  
✅ Improved error handling and logging  
✅ Enhanced duplicate detection  
✅ Better CORS configuration  

### v0.1.0
🎉 Initial release  
✅ Basic code capture functionality  
✅ Snippet management  
✅ VS Code integration  

## License
MIT License - see LICENSE file for details

## Contributing
We welcome contributions! Please see our Contributing Guide for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---
Happy Coding! 💻✨  

Build your personal code knowledge base with Code Vault - because great developers never write the same code twice.

---
**Code Vault is developed and maintained by Ann Studios**
