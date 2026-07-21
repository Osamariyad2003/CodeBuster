import React, { useCallback, useState, useRef } from 'react';
import { Card, ListGroup, Spinner, Alert, Form, Badge, Button } from 'react-bootstrap';
import { apiClient } from './lib/apiClient';
import { FaFolder, FaFolderOpen, FaFileAlt, FaCloudUploadAlt, FaCheckCircle, FaFolderPlus, FaExclamationTriangle } from 'react-icons/fa';

// Text file extensions to include
const TEXT_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.go', '.rb', '.php', '.html', '.css', '.scss', '.sass', '.less',
  '.json', '.xml', '.yaml', '.yml', '.md', '.txt', '.sh', '.bash', '.sql',
  '.rs', '.swift', '.kt', '.scala', '.vue', '.svelte', '.astro', '.env',
  '.gitignore', '.eslintrc', '.prettierrc', '.toml', '.ini', '.cfg', '.conf',
  '.properties', '.gradle', '.pom'
];

// Special filenames without extensions
const SPECIAL_FILES = [
  'Makefile', 'Dockerfile', 'Jenkinsfile', 'Rakefile', 'Gemfile',
  'package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.js',
  '.gitignore', '.eslintrc', '.prettierrc', '.babelrc', '.editorconfig'
];

// Directories to skip
const SKIP_DIRS = [
  'node_modules', '.git', '__pycache__', 'dist', 'build', '.next',
  'venv', '.venv', 'env', 'vendor', 'target', '.idea',
  '.vscode', 'coverage', '.cache', '.parcel-cache', 'out', 'bin', 'obj'
];

// Helper function to check if file should be included
const shouldIncludeFile = (filename) => {
  const basename = filename.split(/[/\\]/).pop();

  // Check special files first
  if (SPECIAL_FILES.includes(basename)) return true;

  // Check extensions
  const lastDotIndex = basename.lastIndexOf('.');
  if (lastDotIndex === -1) return false; // No extension and not a special file

  const ext = basename.substring(lastDotIndex).toLowerCase();
  return TEXT_EXTENSIONS.includes(ext);
};

// Helper function to check if path contains skip directory
const shouldSkipPath = (path) => {
  const parts = path.split(/[/\\]/);
  return parts.some(part => SKIP_DIRS.includes(part));
};

// Helper function to build the file tree
const buildFileTree = (files) => {
  const tree = {};

  files.forEach(file => {
    const parts = file.path.split('/').filter(p => p);
    let current = tree;
    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = {
          _type: index === parts.length - 1 ? 'file' : 'folder',
          _path: parts.slice(0, index + 1).join('/'),
          _content: index === parts.length - 1 ? file.content : undefined,
          _name: part,
          _children: {},
        };
      }
      current = current[part]._children;
    });
  });

  return tree;
};

// Recursive FileTree component
const FileTree = ({ tree, level = 0, onFileSelect, filter }) => {
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (name) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const matchesFilter = (node, filterTerm) => {
    if (!filterTerm) return true;
    const lowerFilter = filterTerm.toLowerCase();

    if (node._type === 'file') {
      return node._name.toLowerCase().includes(lowerFilter);
    }

    if (node._name.toLowerCase().includes(lowerFilter)) return true;

    return Object.values(node._children).some(child => matchesFilter(child, filterTerm));
  };

  const filteredEntries = Object.entries(tree).filter(([name, node]) =>
    matchesFilter(node, filter)
  );

  return (
    <ListGroup variant="flush" style={{ paddingLeft: level * 15 }}>
      {filteredEntries.map(([name, node]) => (
        <React.Fragment key={node._path}>
          {node._type === 'folder' ? (
            <>
              <ListGroup.Item
                action
                onClick={() => toggleExpand(name)}
                className="d-flex align-items-center"
                style={{
                  paddingLeft: 12 + level * 15,
                  paddingTop: '10px',
                  paddingBottom: '10px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--card-border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {expanded[name] ? (
                  <FaFolderOpen className="me-2" style={{ color: '#f59e0b', fontSize: '1rem' }} />
                ) : (
                  <FaFolder className="me-2" style={{ color: '#f59e0b', fontSize: '1rem' }} />
                )}
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{name}</span>
              </ListGroup.Item>
              {expanded[name] && (
                <FileTree
                  tree={node._children}
                  level={level + 1}
                  onFileSelect={onFileSelect}
                  filter={filter}
                />
              )}
            </>
          ) : (
            <ListGroup.Item
              action
              onClick={() => onFileSelect && onFileSelect(node._path, node._content)}
              className="d-flex align-items-center"
              style={{
                paddingLeft: 12 + level * 15,
                paddingTop: '10px',
                paddingBottom: '10px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--card-border-color)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <FaFileAlt className="me-2" style={{ color: 'var(--primary-blue)', fontSize: '0.9rem' }} />
              <span style={{ fontSize: '0.9rem' }}>{name}</span>
            </ListGroup.Item>
          )}
        </React.Fragment>
      ))}
    </ListGroup>
  );
};


const ProjectDropzone = ({ onReviewComplete }) => {
  const [projectFiles, setProjectFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileFilter, setFileFilter] = useState('');
  const [reviewComplete, setReviewComplete] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const folderInputRef = useRef(null);
  const dropzoneRef = useRef(null);

  // Read file content as text
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsText(file);
    });
  };

  // Process files from input (regular File objects with webkitRelativePath)
  const processInputFiles = async (files) => {
    const result = [];
    console.log(`Processing ${files.length} files from input...`);

    for (const file of files) {
      try {
        // Use webkitRelativePath for folder structure, fallback to name
        const relativePath = file.webkitRelativePath || file.name;

        console.log(`Checking file: ${relativePath}`);

        // Skip files in excluded directories
        if (shouldSkipPath(relativePath)) {
          console.log(`  Skipping (excluded directory): ${relativePath}`);
          continue;
        }

        // Skip non-text files
        if (!shouldIncludeFile(file.name)) {
          console.log(`  Skipping (not a text file): ${file.name}`);
          continue;
        }

        const content = await readFileContent(file);
        const path = '/' + relativePath;
        console.log(`  Added: ${path}`);
        result.push({ path, content });
      } catch (err) {
        console.warn(`Failed to read file: ${file.name}`, err);
      }
    }

    console.log(`Total files processed: ${result.length}`);
    return result;
  };

  // Process files from drag-and-drop (using FileSystemEntry API)
  const processDragDropItems = async (dataTransferItems) => {
    const files = [];
    console.log(`Processing ${dataTransferItems.length} drag-drop items...`);

    const traverseEntry = async (entry, basePath = '') => {
      if (!entry) return;

      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file(
            async (file) => {
              try {
                const fullPath = basePath ? `${basePath}/${file.name}` : `/${file.name}`;

                if (shouldSkipPath(fullPath)) {
                  resolve();
                  return;
                }

                if (!shouldIncludeFile(file.name)) {
                  resolve();
                  return;
                }

                const content = await readFileContent(file);
                console.log(`  Added from drag: ${fullPath}`);
                files.push({ path: fullPath, content });
                resolve();
              } catch (err) {
                console.warn(`Failed to read dragged file: ${file.name}`, err);
                resolve();
              }
            },
            () => resolve()
          );
        });
      } else if (entry.isDirectory) {
        const dirPath = basePath ? `${basePath}/${entry.name}` : `/${entry.name}`;

        // Skip excluded directories
        if (SKIP_DIRS.includes(entry.name)) {
          console.log(`  Skipping directory: ${entry.name}`);
          return;
        }

        console.log(`  Entering directory: ${dirPath}`);

        // Read all entries from directory
        const dirReader = entry.createReader();

        const readAllEntries = () => {
          return new Promise((resolve) => {
            const allEntries = [];

            const readBatch = () => {
              dirReader.readEntries(
                (entries) => {
                  if (entries.length === 0) {
                    resolve(allEntries);
                  } else {
                    allEntries.push(...entries);
                    readBatch(); // Continue reading
                  }
                },
                () => resolve(allEntries)
              );
            };

            readBatch();
          });
        };

        const entries = await readAllEntries();
        console.log(`  Found ${entries.length} entries in ${dirPath}`);

        // Process each entry sequentially to avoid overwhelming the browser
        for (const childEntry of entries) {
          await traverseEntry(childEntry, dirPath);
        }
      }
    };

    // Process each dropped item
    for (const item of dataTransferItems) {
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          await traverseEntry(entry, '');
        }
      }
    }

    console.log(`Total files from drag-drop: ${files.length}`);
    return files;
  };

  // Main file processing function
  const processFiles = async (files, fromDragDrop = false, dataTransferItems = null) => {
    setLoading(true);
    setError(null);
    setReviewComplete(false);
    setProjectFiles([]);

    try {
      let fileList = [];

      if (fromDragDrop && dataTransferItems) {
        // Process drag-drop with FileSystemEntry API
        fileList = await processDragDropItems(dataTransferItems);
      } else {
        // Process regular file input
        fileList = await processInputFiles(files);
      }

      if (fileList.length === 0) {
        setError('No supported source code files found. Make sure the folder contains files like .js, .py, .java, .ts, etc.');
        setLoading(false);
        return;
      }

      setProjectFiles(fileList);

      console.log(`Sending ${fileList.length} files to server for review...`);

      // Check if mock data is enabled
      const useMockData = import.meta.env.VITE_USE_MOCK_DATA === 'true';

      if (useMockData) {
        // Simulate API delay and return mock data
        await new Promise(resolve => setTimeout(resolve, 1500));

        const mockIssues = fileList.slice(0, 15).map((file, idx) => ({
          type: ['security', 'performance', 'code_quality', 'best_practices', 'error_handling', 'complexity'][idx % 6],
          severity: ['high', 'medium', 'low', 'low', 'medium', 'high'][idx % 6],
          message: `Issue detected in ${file.path}`,
          file: file.path,
          line: Math.floor(Math.random() * 100) + 1,
          suggestion: "Consider refactoring this code for better maintainability"
        }));

        // Generate comprehensive mock comments for multiple files
        const mockComments = [
          {
            text: 'SQL injection vulnerability detected. User input is being directly concatenated into SQL query.',
            severity: 'high',
            category: 'Security',
            suggestion: '// Use parameterized queries instead\nconst query = "SELECT * FROM users WHERE id = ?";\ndb.query(query, [userId], (err, results) => {\n  // Handle results\n});'
          },
          {
            text: 'Hardcoded credentials found. Sensitive information should be stored in environment variables.',
            severity: 'high',
            category: 'Security',
            suggestion: '// Use environment variables\nconst apiKey = process.env.API_KEY;\nconst dbPassword = process.env.DB_PASSWORD;'
          },
          {
            text: 'Missing input validation. User input should be validated before processing.',
            severity: 'medium',
            category: 'Security',
            suggestion: '// Validate input\nif (!input || typeof input !== "string" || input.length > 255) {\n  throw new Error("Invalid input");\n}\nconst sanitized = validator.escape(input);'
          },
          {
            text: 'Inefficient database query in loop. Consider using batch operations.',
            severity: 'medium',
            category: 'Performance',
            suggestion: '// Use batch query\nconst ids = items.map(item => item.id);\nconst results = await db.query("SELECT * FROM table WHERE id IN (?)", [ids]);'
          },
          {
            text: 'Large array being copied multiple times. Use references or optimize data structure.',
            severity: 'medium',
            category: 'Performance',
            suggestion: '// Avoid unnecessary copies\nconst processedData = data.map(item => transform(item));\n// Instead of: const copy = [...data]; const processed = copy.map(...);'
          },
          {
            text: 'Synchronous file operation blocking event loop. Use async version.',
            severity: 'high',
            category: 'Performance',
            suggestion: '// Use async file operations\nconst fs = require("fs").promises;\nconst data = await fs.readFile(filepath, "utf8");'
          },
          {
            text: 'Function has cyclomatic complexity of 18. Consider breaking into smaller functions.',
            severity: 'medium',
            category: 'Code Quality',
            suggestion: '// Break into smaller functions\nfunction processData(data) {\n  const validated = validateData(data);\n  const transformed = transformData(validated);\n  return saveData(transformed);\n}'
          },
          {
            text: 'Duplicate code found across multiple functions. Extract to shared utility.',
            severity: 'low',
            category: 'Code Quality',
            suggestion: '// Extract to utility function\nfunction formatUserData(user) {\n  return {\n    id: user.id,\n    name: user.name.trim(),\n    email: user.email.toLowerCase()\n  };\n}'
          },
          {
            text: 'Variable naming is inconsistent. Follow camelCase convention.',
            severity: 'low',
            category: 'Style',
            suggestion: '// Use consistent naming\nconst userData = {};\nconst userProfile = {};\n// Not: user_data, UserProfile'
          },
          {
            text: 'Missing error handling in async function. Always handle promise rejections.',
            severity: 'high',
            category: 'Best Practices',
            suggestion: '// Add proper error handling\nasync function fetchData() {\n  try {\n    const response = await fetch(url);\n    return await response.json();\n  } catch (error) {\n    logger.error("Failed to fetch:", error);\n    throw error;\n  }\n}'
          },
          {
            text: 'Missing JSDoc comments for public API function.',
            severity: 'low',
            category: 'Best Practices',
            suggestion: '/**\n * Processes user data and returns formatted result\n * @param {Object} user - User object\n * @param {string} user.id - User ID\n * @returns {Promise<Object>} Processed user data\n */\nfunction processUser(user) { ... }'
          },
          {
            text: 'Unused import detected. Remove to improve bundle size.',
            severity: 'low',
            category: 'Code Quality',
            suggestion: '// Remove unused imports\n// import { useState, useEffect } from "react";\nimport { useState } from "react"; // Only import what you use'
          },
          {
            text: 'Memory leak: Event listener not cleaned up in component unmount.',
            severity: 'high',
            category: 'Best Practices',
            suggestion: '// Cleanup in useEffect\nuseEffect(() => {\n  const handler = () => console.log("event");\n  window.addEventListener("resize", handler);\n  return () => window.removeEventListener("resize", handler);\n}, []);'
          },
          {
            text: 'Using deprecated API. Update to current recommended approach.',
            severity: 'medium',
            category: 'Best Practices',
            suggestion: '// Use modern API\n// Old: componentWillMount()\n// New: Use useEffect() hook or constructor'
          },
          {
            text: 'No rate limiting on API endpoint. Add throttling to prevent abuse.',
            severity: 'medium',
            category: 'Security',
            suggestion: '// Add rate limiting\nconst rateLimit = require("express-rate-limit");\nconst limiter = rateLimit({\n  windowMs: 15 * 60 * 1000,\n  max: 100\n});\napp.use("/api/", limiter);'
          }
        ];

        const mockDetailedResponse = {
          quality_score: 6.5,
          summary: {
            high_severity: 8,
            medium_severity: 12,
            low_severity: 18,
            total_issues: 38,
            categories: {
              security: 8,
              performance: 6,
              code_quality: 10,
              best_practices: 9,
              style: 3,
              complexity: 2
            }
          },
          files: fileList.slice(0, Math.min(10, fileList.length)).map((file, idx) => ({
            path: file.path,
            comments: mockComments.slice(idx, idx + 3).map((comment, commentIdx) => ({
              line: 15 + (idx * 10) + (commentIdx * 5),
              ...comment
            }))
          })),
          timestamp: new Date().toISOString(),
          category_scores: {
            security: 65,
            code_quality: 70,
            performance: 68,
            best_practices: 72,
            style: 85,
            complexity: 60
          },
          findings_count: {
            critical: 5,
            major: 12,
            minor: 18,
            info: 3
          },
          analysis_metadata: {
            started_at: new Date(Date.now() - 2000).toISOString(),
            completed_at: new Date().toISOString(),
            duration_seconds: 2.0,
            analyzers_run: ['security', 'code_quality', 'performance', 'best_practices', 'style'],
            files_analyzed: fileList.length,
            lines_analyzed: fileList.length * 85
          }
        };

        // For backward compatibility, also include legacy format
        const mockLegacyResponse = {
          health_score: 65,
          summary: "Code has several issues requiring attention. Focus on security and performance improvements.",
          issues: mockIssues
        };

        onReviewComplete(mockLegacyResponse, fileList, mockDetailedResponse);
        setReviewComplete(true);
        console.log('Mock review complete!');
      } else {
        // Use production-grade apiClient for retries and request IDs
        const response = await apiClient.post('/api/reviews', {
          repository_id: 'manual-upload', // Or some identifier for manual uploads
          files: fileList.map(f => f.path),
          file_contents: fileList // Optional: existing API might expect this
        });

        // If the API returns a job_id (async), we might need to poll
        if (response.job_id) {
          // Polling logic would go here, but for now we assume immediate or handled by parent
          onReviewComplete({ id: response.job_id, status: 'queued' }, fileList);
        } else {
          onReviewComplete(response, fileList);
        }

        setReviewComplete(true);
        console.log('Review complete!');
      }
    } catch (err) {
      console.error('Error processing files:', err);
      setError(`Failed to process files: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle folder input change
  const handleFolderSelect = (event) => {
    const files = Array.from(event.target.files || []);
    console.log(`Folder selected with ${files.length} files`);
    if (files.length > 0) {
      processFiles(files, false, null);
    }
    // Reset input so same folder can be selected again
    event.target.value = '';
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set inactive if leaving the dropzone entirely
    if (!dropzoneRef.current?.contains(e.relatedTarget)) {
      setIsDragActive(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const items = e.dataTransfer?.items;
    if (items && items.length > 0) {
      // Check if any item is a directory entry
      const itemsArray = Array.from(items);
      const hasEntries = itemsArray.some(item => {
        const entry = item.webkitGetAsEntry?.();
        return entry != null;
      });

      if (hasEntries) {
        console.log('Processing drag-drop with FileSystemEntry API...');
        await processFiles(null, true, itemsArray);
      } else {
        // Fallback to regular files
        const files = Array.from(e.dataTransfer.files);
        console.log(`Processing ${files.length} dropped files (no entry API)...`);
        await processFiles(files, false, null);
      }
    }
  };

  const fileTree = buildFileTree(projectFiles);

  return (
    <Card
      className="dropzone-card"
      style={{
        background: 'var(--glass-background)',
        backdropFilter: 'blur(10px)',
        border: '1px solid var(--card-border-color)',
        borderRadius: 20
      }}
    >
      <Card.Body>
        {/* Hidden folder input */}
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          style={{ display: 'none' }}
          onChange={handleFolderSelect}
        />

        <div
          ref={dropzoneRef}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="text-center"
          style={{
            cursor: 'pointer',
            borderRadius: 18,
            transition: 'all 0.25s ease',
            padding: '3rem 2rem',
            background: isDragActive
              ? 'linear-gradient(135deg, rgba(79, 138, 201, 0.12) 0%, rgba(91, 164, 207, 0.08) 100%)'
              : 'var(--card-background-color)',
            border: `2px dashed ${isDragActive ? 'var(--primary-blue)' : 'var(--card-border-color)'}`,
            transform: isDragActive ? 'scale(1.01)' : 'scale(1)',
            boxShadow: isDragActive ? '0 10px 28px rgba(79, 138, 201, 0.22)' : 'none'
          }}
        >
          {loading ? (
            <div className="py-4">
              <div style={{
                width: 70,
                height: 70,
                margin: '0 auto 1.5rem',
                borderRadius: '50%',
                border: '5px solid rgba(79, 138, 201, 0.18)',
                borderTopColor: 'var(--primary-blue)',
                animation: 'spin 0.8s linear infinite'
              }} />
              <h5 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Analyzing your code with AI...</h5>
              <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
                Processing {projectFiles.length || '...'} files
              </p>
            </div>
          ) : reviewComplete ? (
            <div className="py-4">
              <div
                className="mx-auto mb-4"
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(59, 167, 140, 0.2) 0%, rgba(91, 164, 207, 0.12) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(59, 167, 140, 0.25)'
                }}
              >
                <FaCheckCircle size={44} style={{ color: 'var(--success-green)' }} />
              </div>
              <h4 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Review Complete!</h4>
              <p className="text-muted mb-3">Drop another project to review</p>
              <Button
                onClick={() => folderInputRef.current?.click()}
                className="d-flex align-items-center gap-2 mx-auto"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: 12,
                  fontWeight: 600,
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                  transition: 'all 0.2s'
                }}
              >
                <FaFolderPlus />
                Select Another Folder
              </Button>
            </div>
          ) : isDragActive ? (
            <div className="py-4">
              <div
                className="mx-auto mb-4"
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(79, 138, 201, 0.2) 0%, rgba(91, 164, 207, 0.16) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 1.5s infinite'
                }}
              >
                <FaCloudUploadAlt size={50} style={{ color: 'var(--primary-blue)' }} />
              </div>
              <h3 style={{ color: 'var(--primary-blue)', fontWeight: 700, marginBottom: '0.5rem' }}>Drop the folder here</h3>
              <p className="text-muted mb-0" style={{ fontSize: '1rem' }}>Release to upload your project</p>
            </div>
          ) : (
            <div className="py-4">
              <div
                className="mx-auto mb-4"
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(79, 138, 201, 0.12) 0%, rgba(91, 164, 207, 0.08) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FaCloudUploadAlt size={40} style={{ color: 'var(--primary-blue)' }} />
              </div>
              <h4 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Upload Project for AI Review</h4>
              <p className="text-muted mb-4" style={{ fontSize: '1rem', maxWidth: 500, margin: '0 auto 1.5rem' }}>
                Drag & drop a project folder here, or click to select
              </p>

              <Button
                onClick={() => folderInputRef.current?.click()}
                className="d-flex align-items-center gap-2 mx-auto"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  border: 'none',
                  padding: '14px 32px',
                  borderRadius: 12,
                  fontSize: '1.05rem',
                  fontWeight: 600,
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
                  transition: 'all 0.2s'
                }}
              >
                <FaFolderPlus />
                Select Folder
              </Button>

              <div
                className="mt-5 pt-4"
                style={{
                  borderTop: '1px solid var(--card-border-color)',
                  maxWidth: 600,
                  margin: '2rem auto 0'
                }}
              >
                <div
                  className="d-flex flex-wrap justify-content-center gap-3 mb-2"
                  style={{ fontSize: '0.85rem' }}
                >
                  {['JavaScript', 'TypeScript', 'Python', 'Java', 'C/C++', 'Go', 'Ruby', 'PHP'].map((lang, idx) => {
                    const colors = [
                      { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', color: '#d97706', border: 'rgba(245, 158, 11, 0.8)' },
                      { bg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', color: '#1d4ed8', border: 'rgba(59, 130, 246, 0.8)' },
                      { bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', color: '#047857', border: 'rgba(16, 185, 129, 0.8)' },
                      { bg: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', color: '#b91c1c', border: 'rgba(239, 68, 68, 0.8)' },
                      { bg: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', color: '#4338ca', border: 'rgba(99, 102, 241, 0.8)' },
                      { bg: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', color: '#7c3aed', border: 'rgba(168, 85, 247, 0.8)' },
                      { bg: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)', color: '#be185d', border: 'rgba(236, 72, 153, 0.8)' },
                      { bg: 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%)', color: '#0e7490', border: 'rgba(6, 182, 212, 0.8)' }
                    ];
                    const colorScheme = colors[idx % colors.length];
                    return (
                      <Badge
                        key={lang}
                        style={{
                          background: colorScheme.bg,
                          color: colorScheme.color,
                          padding: '10px 18px',
                          fontWeight: 700,
                          border: `2px solid ${colorScheme.border}`,
                          borderRadius: '12px',
                          fontSize: '0.875rem',
                          letterSpacing: '0.3px',
                          transition: 'all 0.2s ease',
                          cursor: 'default',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                        }}
                      >
                        {lang}
                      </Badge>
                    );
                  })}
                </div>
                <small className="text-muted d-block mt-3">
                  ✓ Automatically skips: node_modules, .git, dist, build, venv
                </small>
              </div>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="danger" className="mt-4 rounded-4 border-0 shadow-sm d-flex align-items-center gap-3">
            <FaExclamationTriangle size={24} className="flex-shrink-0" />
            <div className="flex-grow-1">
              <div className="fw-bold">Upload Failed</div>
              <div className="small opacity-75">{error}</div>
            </div>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => processFiles(projectFiles)}
              className="rounded-pill px-3"
            >
              Retry
            </Button>
          </Alert>
        )}

        {projectFiles.length > 0 && !loading && (
          <div className="mt-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex align-items-center gap-2">
                <h6 className="mb-0" style={{ fontWeight: 700 }}>Project Structure</h6>
                <Badge
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    padding: '6px 12px',
                    fontWeight: 600
                  }}
                >
                  {projectFiles.length} files
                </Badge>
              </div>
              <Button
                onClick={() => {
                  setProjectFiles([]);
                  setReviewComplete(false);
                  setError(null);
                }}
                style={{
                  background: 'rgba(244, 63, 94, 0.1)',
                  border: '1px solid rgba(244, 63, 94, 0.2)',
                  color: '#f43f5e',
                  padding: '6px 16px',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: '0.9rem'
                }}
              >
                Clear
              </Button>
            </div>
            <Form.Control
              type="text"
              placeholder="🔍 Filter files..."
              className="mb-3"
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value)}
              style={{
                background: 'var(--card-background-color)',
                border: '1px solid var(--card-border-color)',
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: '0.95rem'
              }}
            />
            <div
              className="file-tree-container"
              style={{
                maxHeight: '400px',
                overflowY: 'auto',
                border: '1px solid var(--card-border-color)',
                borderRadius: 14,
                background: 'var(--card-background-color)'
              }}
            >
              <FileTree tree={fileTree} filter={fileFilter} />
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default ProjectDropzone;
