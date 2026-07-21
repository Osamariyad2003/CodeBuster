export const mockReview = {
    health_score: 85,
    summary: "Code quality is good with minor improvements needed",
    issues: [
        {
            type: "security",
            severity: "high",
            title: "SQL Injection Vulnerability",
            message: "Potential SQL injection vulnerability detected",
            file: "src/api/users.js",
            line: 45,
            suggestion: "Use parameterized queries instead of string concatenation"
        },
        {
            type: "performance",
            severity: "medium",
            title: "Inefficient Loop",
            message: "Inefficient loop detected",
            file: "src/utils/dataProcessor.js",
            line: 120,
            suggestion: "Consider using Array.map() or reduce() for better performance"
        },
        {
            type: "code_quality",
            severity: "low",
            title: "High Complexity",
            message: "Function complexity is high (cyclomatic complexity: 15)",
            file: "src/controllers/orderController.js",
            line: 78,
            suggestion: "Break down into smaller functions for better maintainability"
        },
        {
            type: "best_practices",
            severity: "medium",
            title: "Missing Error Handling",
            message: "Missing error handling in async function",
            file: "src/services/paymentService.js",
            line: 34,
            suggestion: "Add try-catch block to handle potential errors"
        },
        {
            type: "security",
            severity: "high",
            title: "Hardcoded Credentials",
            message: "Hardcoded credentials detected",
            file: "config/database.js",
            line: 12,
            suggestion: "Move credentials to environment variables"
        },
        {
            type: "security",
            severity: "critical",
            title: "XSS Vulnerability",
            message: "Cross-site scripting vulnerability detected in user input handling",
            file: "src/components/CommentForm.jsx",
            line: 67,
            suggestion: "Sanitize user input before rendering. Use DOMPurify or similar library"
        },
        {
            type: "performance",
            severity: "high",
            title: "Memory Leak",
            message: "Potential memory leak - event listener not cleaned up",
            file: "src/hooks/useWebSocket.js",
            line: 89,
            suggestion: "Add cleanup function in useEffect to remove event listeners"
        },
        {
            type: "security",
            severity: "medium",
            title: "Weak Password Policy",
            message: "Password validation is too weak",
            file: "src/utils/validation.js",
            line: 23,
            suggestion: "Enforce stronger password requirements (min 12 chars, special characters, numbers)"
        },
        {
            type: "code_quality",
            severity: "medium",
            title: "Code Duplication",
            message: "Duplicate code block found in multiple files",
            file: "src/services/authService.js",
            line: 156,
            suggestion: "Extract common logic into a shared utility function"
        },
        {
            type: "best_practices",
            severity: "low",
            title: "Console Log in Production",
            message: "Console.log statements found in production code",
            file: "src/utils/logger.js",
            line: 8,
            suggestion: "Remove console.log or use proper logging library"
        },
        {
            type: "performance",
            severity: "medium",
            title: "Large Bundle Size",
            message: "Component bundle size exceeds recommended limit",
            file: "src/pages/Dashboard.jsx",
            line: 1,
            suggestion: "Implement code splitting and lazy loading for better performance"
        },
        {
            type: "security",
            severity: "medium",
            title: "Insecure Random Generator",
            message: "Using Math.random() for security-sensitive operation",
            file: "src/utils/tokenGenerator.js",
            line: 34,
            suggestion: "Use crypto.getRandomValues() for cryptographically secure random numbers"
        },
        {
            type: "code_quality",
            severity: "low",
            title: "Magic Numbers",
            message: "Magic numbers detected - use named constants",
            file: "src/config/constants.js",
            line: 45,
            suggestion: "Define constants with descriptive names instead of hardcoded values"
        },
        {
            type: "best_practices",
            severity: "medium",
            title: "Missing PropTypes",
            message: "Component missing PropTypes validation",
            file: "src/components/UserCard.jsx",
            line: 12,
            suggestion: "Add PropTypes or use TypeScript for type safety"
        },
        {
            type: "performance",
            severity: "low",
            title: "Unnecessary Re-renders",
            message: "Component re-rendering unnecessarily due to missing memoization",
            file: "src/components/ExpensiveList.jsx",
            line: 78,
            suggestion: "Use React.memo() or useMemo to prevent unnecessary re-renders"
        }
    ],
    metrics: {
        total_files: 45,
        total_lines: 3542,
        test_coverage: 72,
        code_duplication: 8
    },
    timestamp: new Date().toISOString()
};

export const mockRepos = [
    {
        id: 1,
        name: "my-awesome-project",
        full_name: "username/my-awesome-project",
        private: false,
        html_url: "https://github.com/username/my-awesome-project",
        description: "An awesome project with React and Node.js",
        language: "JavaScript",
        stargazers_count: 125,
        forks_count: 23,
        open_issues_count: 5,
        updated_at: "2024-01-15T10:30:00Z",
        health_score: 85,
        last_review: "2024-01-14T08:20:00Z"
    },
    {
        id: 2,
        name: "python-data-analyzer",
        full_name: "username/python-data-analyzer",
        private: true,
        html_url: "https://github.com/username/python-data-analyzer",
        description: "Data analysis tool built with Python",
        language: "Python",
        stargazers_count: 87,
        forks_count: 12,
        open_issues_count: 2,
        updated_at: "2024-01-14T15:20:00Z",
        health_score: 92,
        last_review: "2024-01-13T14:15:00Z"
    },
    {
        id: 3,
        name: "mobile-app-starter",
        full_name: "username/mobile-app-starter",
        private: false,
        html_url: "https://github.com/username/mobile-app-starter",
        description: "React Native starter template",
        language: "TypeScript",
        stargazers_count: 342,
        forks_count: 56,
        open_issues_count: 8,
        updated_at: "2024-01-13T09:45:00Z",
        health_score: 78,
        last_review: "2024-01-12T11:30:00Z"
    },
    {
        id: 4,
        name: "e-commerce-backend",
        full_name: "username/e-commerce-backend",
        private: true,
        html_url: "https://github.com/username/e-commerce-backend",
        description: "Full-featured e-commerce backend with microservices",
        language: "Java",
        stargazers_count: 234,
        forks_count: 45,
        open_issues_count: 12,
        updated_at: "2024-01-15T16:00:00Z",
        health_score: 88,
        last_review: "2024-01-15T09:00:00Z"
    },
    {
        id: 5,
        name: "ml-model-training",
        full_name: "username/ml-model-training",
        private: false,
        html_url: "https://github.com/username/ml-model-training",
        description: "Machine learning model training pipeline",
        language: "Python",
        stargazers_count: 567,
        forks_count: 123,
        open_issues_count: 3,
        updated_at: "2024-01-14T20:10:00Z",
        health_score: 95,
        last_review: "2024-01-14T10:45:00Z"
    },
    {
        id: 6,
        name: "devops-automation",
        full_name: "username/devops-automation",
        private: true,
        html_url: "https://github.com/username/devops-automation",
        description: "CI/CD pipeline automation tools",
        language: "Go",
        stargazers_count: 189,
        forks_count: 34,
        open_issues_count: 7,
        updated_at: "2024-01-15T11:25:00Z",
        health_score: 82,
        last_review: "2024-01-14T16:20:00Z"
    },
    {
        id: 7,
        name: "chat-application",
        full_name: "username/chat-application",
        private: false,
        html_url: "https://github.com/username/chat-application",
        description: "Real-time chat application with WebSocket",
        language: "JavaScript",
        stargazers_count: 456,
        forks_count: 89,
        open_issues_count: 15,
        updated_at: "2024-01-13T14:30:00Z",
        health_score: 73,
        last_review: "2024-01-12T09:15:00Z"
    },
    {
        id: 8,
        name: "blockchain-wallet",
        full_name: "username/blockchain-wallet",
        private: true,
        html_url: "https://github.com/username/blockchain-wallet",
        description: "Secure cryptocurrency wallet",
        language: "Rust",
        stargazers_count: 678,
        forks_count: 145,
        open_issues_count: 4,
        updated_at: "2024-01-15T13:40:00Z",
        health_score: 91,
        last_review: "2024-01-15T07:30:00Z"
    },
    {
        id: 9,
        name: "api-gateway",
        full_name: "username/api-gateway",
        private: false,
        html_url: "https://github.com/username/api-gateway",
        description: "High-performance API gateway",
        language: "Go",
        stargazers_count: 321,
        forks_count: 67,
        open_issues_count: 9,
        updated_at: "2024-01-14T09:15:00Z",
        health_score: 87,
        last_review: "2024-01-13T15:45:00Z"
    },
    {
        id: 10,
        name: "ui-component-library",
        full_name: "username/ui-component-library",
        private: false,
        html_url: "https://github.com/username/ui-component-library",
        description: "Reusable React component library",
        language: "TypeScript",
        stargazers_count: 892,
        forks_count: 234,
        open_issues_count: 18,
        updated_at: "2024-01-15T17:50:00Z",
        health_score: 80,
        last_review: "2024-01-15T12:10:00Z"
    }
];

export const mockUser = {
    id: 12345,
    login: "testuser",
    name: "Test Developer",
    avatar_url: "https://avatars.githubusercontent.com/u/12345?v=4",
    email: "test@example.com"
};

// Chart data for analytics dashboard
export const mockChartData = {
    // Health score trend over time
    healthScoreTrend: [
        { date: '2024-01-01', score: 78 },
        { date: '2024-01-02', score: 79 },
        { date: '2024-01-03', score: 81 },
        { date: '2024-01-04', score: 80 },
        { date: '2024-01-05', score: 82 },
        { date: '2024-01-06', score: 83 },
        { date: '2024-01-07', score: 85 },
        { date: '2024-01-08', score: 84 },
        { date: '2024-01-09', score: 86 },
        { date: '2024-01-10', score: 87 },
        { date: '2024-01-11', score: 85 },
        { date: '2024-01-12', score: 88 },
        { date: '2024-01-13', score: 87 },
        { date: '2024-01-14', score: 89 },
        { date: '2024-01-15', score: 85 }
    ],

    // Issues by severity
    issuesBySeverity: [
        { severity: 'Critical', count: 2, color: '#dc2626' },
        { severity: 'High', count: 5, color: '#ea580c' },
        { severity: 'Medium', count: 8, color: '#f59e0b' },
        { severity: 'Low', count: 12, color: '#84cc16' }
    ],

    // Issues by type
    issuesByType: [
        { type: 'Security', count: 8, percentage: 30 },
        { type: 'Performance', count: 6, percentage: 22 },
        { type: 'Code Quality', count: 7, percentage: 26 },
        { type: 'Best Practices', count: 6, percentage: 22 }
    ],

    // Test coverage trend
    testCoverageTrend: [
        { date: '2024-01-01', coverage: 65 },
        { date: '2024-01-02', coverage: 66 },
        { date: '2024-01-03', coverage: 67 },
        { date: '2024-01-04', coverage: 67 },
        { date: '2024-01-05', coverage: 68 },
        { date: '2024-01-06', coverage: 69 },
        { date: '2024-01-07', coverage: 70 },
        { date: '2024-01-08', coverage: 70 },
        { date: '2024-01-09', coverage: 71 },
        { date: '2024-01-10', coverage: 71 },
        { date: '2024-01-11', coverage: 72 },
        { date: '2024-01-12', coverage: 72 },
        { date: '2024-01-13', coverage: 73 },
        { date: '2024-01-14', coverage: 72 },
        { date: '2024-01-15', coverage: 72 }
    ],

    // Code quality metrics
    codeQualityMetrics: [
        { metric: 'Maintainability', score: 82, target: 85 },
        { metric: 'Reliability', score: 88, target: 90 },
        { metric: 'Security', score: 76, target: 95 },
        { metric: 'Testability', score: 79, target: 80 }
    ],

    // Review activity over time
    reviewActivity: [
        { date: '2024-01-01', reviews: 3, issues_found: 12 },
        { date: '2024-01-02', reviews: 5, issues_found: 18 },
        { date: '2024-01-03', reviews: 4, issues_found: 15 },
        { date: '2024-01-04', reviews: 2, issues_found: 8 },
        { date: '2024-01-05', reviews: 6, issues_found: 22 },
        { date: '2024-01-06', reviews: 4, issues_found: 14 },
        { date: '2024-01-07', reviews: 7, issues_found: 25 },
        { date: '2024-01-08', reviews: 5, issues_found: 19 },
        { date: '2024-01-09', reviews: 3, issues_found: 11 },
        { date: '2024-01-10', reviews: 8, issues_found: 28 },
        { date: '2024-01-11', reviews: 6, issues_found: 21 },
        { date: '2024-01-12', reviews: 4, issues_found: 16 },
        { date: '2024-01-13', reviews: 5, issues_found: 17 },
        { date: '2024-01-14', reviews: 7, issues_found: 24 },
        { date: '2024-01-15', reviews: 9, issues_found: 31 }
    ],

    // Language distribution
    languageDistribution: [
        { language: 'JavaScript', percentage: 35, lines: 12450 },
        { language: 'TypeScript', percentage: 28, lines: 9980 },
        { language: 'Python', percentage: 22, lines: 7840 },
        { language: 'Java', percentage: 10, lines: 3560 },
        { language: 'Go', percentage: 5, lines: 1780 }
    ],

    // Repository health scores
    repositoryHealthScores: [
        { name: 'my-awesome-project', score: 85 },
        { name: 'python-data-analyzer', score: 92 },
        { name: 'mobile-app-starter', score: 78 },
        { name: 'e-commerce-backend', score: 88 },
        { name: 'ml-model-training', score: 95 },
        { name: 'devops-automation', score: 82 },
        { name: 'chat-application', score: 73 },
        { name: 'blockchain-wallet', score: 91 },
        { name: 'api-gateway', score: 87 },
        { name: 'ui-component-library', score: 80 }
    ],

    // Issues resolved over time
    issuesResolved: [
        { date: '2024-01-01', resolved: 8, new: 12 },
        { date: '2024-01-02', resolved: 10, new: 9 },
        { date: '2024-01-03', resolved: 12, new: 8 },
        { date: '2024-01-04', resolved: 7, new: 6 },
        { date: '2024-01-05', resolved: 15, new: 14 },
        { date: '2024-01-06', resolved: 11, new: 10 },
        { date: '2024-01-07', resolved: 13, new: 11 },
        { date: '2024-01-08', resolved: 9, new: 7 },
        { date: '2024-01-09', resolved: 14, new: 12 },
        { date: '2024-01-10', resolved: 16, new: 15 },
        { date: '2024-01-11', resolved: 12, new: 13 },
        { date: '2024-01-12', resolved: 10, new: 9 },
        { date: '2024-01-13', resolved: 18, new: 16 },
        { date: '2024-01-14', resolved: 14, new: 11 },
        { date: '2024-01-15', resolved: 11, new: 10 }
    ]
};

// Statistics data
export const mockStats = {
    totalReviews: 156,
    totalIssuesFound: 487,
    totalIssuesResolved: 423,
    averageHealthScore: 85,
    totalRepositories: 10,
    activeRepositories: 8,
    criticalIssuesOpen: 2,
    highPriorityIssuesOpen: 5,
    averageResolutionTime: '2.3 days',
    codeQualityImprovement: '+12%',
    testCoverageIncrease: '+7%',
    securityVulnerabilitiesFixed: 34
};

// Recent reviews data
export const mockRecentReviews = [
    {
        id: 1,
        repository: 'my-awesome-project',
        branch: 'main',
        health_score: 85,
        issues_found: 15,
        timestamp: '2024-01-15T10:30:00Z',
        reviewer: 'AI Reviewer',
        status: 'completed'
    },
    {
        id: 2,
        repository: 'python-data-analyzer',
        branch: 'develop',
        health_score: 92,
        issues_found: 7,
        timestamp: '2024-01-14T15:20:00Z',
        reviewer: 'AI Reviewer',
        status: 'completed'
    },
    {
        id: 3,
        repository: 'mobile-app-starter',
        branch: 'feature/new-ui',
        health_score: 78,
        issues_found: 23,
        timestamp: '2024-01-13T09:45:00Z',
        reviewer: 'AI Reviewer',
        status: 'completed'
    },
    {
        id: 4,
        repository: 'e-commerce-backend',
        branch: 'main',
        health_score: 88,
        issues_found: 12,
        timestamp: '2024-01-15T16:00:00Z',
        reviewer: 'AI Reviewer',
        status: 'completed'
    },
    {
        id: 5,
        repository: 'ml-model-training',
        branch: 'main',
        health_score: 95,
        issues_found: 4,
        timestamp: '2024-01-14T20:10:00Z',
        reviewer: 'AI Reviewer',
        status: 'completed'
    },
    {
        id: 6,
        repository: 'devops-automation',
        branch: 'staging',
        health_score: 82,
        issues_found: 18,
        timestamp: '2024-01-14T11:25:00Z',
        reviewer: 'AI Reviewer',
        status: 'completed'
    },
    {
        id: 7,
        repository: 'chat-application',
        branch: 'main',
        health_score: 73,
        issues_found: 28,
        timestamp: '2024-01-13T14:30:00Z',
        reviewer: 'AI Reviewer',
        status: 'completed'
    },
    {
        id: 8,
        repository: 'blockchain-wallet',
        branch: 'security-patch',
        health_score: 91,
        issues_found: 9,
        timestamp: '2024-01-15T13:40:00Z',
        reviewer: 'AI Reviewer',
        status: 'completed'
    }
];

// Team members data
export const mockTeamMembers = [
    {
        id: 1,
        name: 'Sarah Johnson',
        role: 'Senior Developer',
        avatar: 'https://i.pravatar.cc/150?img=1',
        reviews_conducted: 45,
        issues_resolved: 123,
        contribution_score: 92
    },
    {
        id: 2,
        name: 'Michael Chen',
        role: 'Full Stack Developer',
        avatar: 'https://i.pravatar.cc/150?img=2',
        reviews_conducted: 38,
        issues_resolved: 98,
        contribution_score: 87
    },
    {
        id: 3,
        name: 'Emily Rodriguez',
        role: 'Backend Developer',
        avatar: 'https://i.pravatar.cc/150?img=3',
        reviews_conducted: 52,
        issues_resolved: 145,
        contribution_score: 95
    },
    {
        id: 4,
        name: 'David Kim',
        role: 'DevOps Engineer',
        avatar: 'https://i.pravatar.cc/150?img=4',
        reviews_conducted: 31,
        issues_resolved: 87,
        contribution_score: 84
    },
    {
        id: 5,
        name: 'Jessica Williams',
        role: 'Frontend Developer',
        avatar: 'https://i.pravatar.cc/150?img=5',
        reviews_conducted: 42,
        issues_resolved: 110,
        contribution_score: 89
    }
];