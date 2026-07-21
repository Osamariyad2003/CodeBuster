import os

def get_language_from_extension(filepath):
    """Determine programming language from file extension."""
    _, ext = os.path.splitext(filepath)
    ext = ext.lower()

    language_map = {
        '.js': 'javascript', '.jsx': 'javascript',
        '.ts': 'typescript', '.tsx': 'typescript',
        '.py': 'python',
        '.java': 'java',
        '.c': 'c', '.h': 'c',
        '.cpp': 'cpp', '.hpp': 'cpp', '.cxx': 'cpp',
        '.cs': 'csharp',
        '.go': 'go',
        '.html': 'html', '.htm': 'html',
        '.css': 'css',
        '.json': 'json',
        '.md': 'markdown', '.markdown': 'markdown',
        '.php': 'php',
        '.rb': 'ruby',
        '.xml': 'xml',
        '.sh': 'bash', '.bash': 'bash',
        '.sql': 'sql',
        '.yml': 'yaml', '.yaml': 'yaml',
        '.rs': 'rust',
    }
    
    return language_map.get(ext, 'text')

def calculate_code_quality_score(comments):
    """Calculate overall code quality score."""
    if not comments:
        return 10.0
    
    severity_weights = {'high': 1.5, 'medium': 1.0, 'low': 0.5}
    total_penalty = sum(severity_weights.get(c.get('severity', 'low'), 0.5) for c in comments)
    score = max(0, 10 - (total_penalty * 0.3))
    return round(score, 1)

def generate_ai_review(files):
    """Generate AI review for code files."""
    comments = []
    
    for file in files:
        filename = file.get('filename', file.get('path', 'unknown'))
        content = file.get('content', '')
        
        if 'TODO' in content:
            comments.append({
                "text": f"Found a TODO in {filename}. Please resolve it before merging.",
                "severity": "low",
                "category": "Maintenance",
                "file": filename
            })
            
        if 'print(' in content and filename.endswith('.py'):
            comments.append({
                "text": f"Console logging detected in {filename}. Use a logger for production code.",
                "severity": "medium",
                "category": "Best Practices",
                "file": filename
            })
            
        if len(content.split('\n')) > 200:
            comments.append({
                "text": f"File {filename} is quite long ({len(content.split('\n'))} lines). Consider refactoring.",
                "severity": "medium",
                "category": "Complexity",
                "file": filename
            })
    
    return {
        "comments": comments,
        "quality_score": calculate_code_quality_score(comments),
        "summary": f"Analyzed {len(files)} files. Found {len(comments)} potential issues."
    }