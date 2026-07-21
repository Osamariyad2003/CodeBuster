# CodeBuster - AI/ML Pipeline Design

## Overview

The AI/ML pipeline aggregates findings from all analyzers, enriches them with repository context using RAG, and produces structured, explainable output with confidence scores. The system learns from user feedback to improve over time.

---

## 1. AI REASONING PIPELINE

### 1.1 Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    FINDING AGGREGATION                          │
│  Input: Raw findings from all analyzers (JSON)                 │
│  Output: Deduplicated, normalized findings                     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RAG CONTEXT RETRIEVAL                        │
│  - Repository README, style guides                              │
│  - Past PRs and resolutions                                     │
│  - Team preferences (accepted/dismissed patterns)                │
│  - Related code context                                         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LLM REASONING                                │
│  - Issue prioritization                                         │
│  - Explanation generation                                       │
│  - Fix suggestions                                              │
│  - Confidence scoring                                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OUTPUT VALIDATION                            │
│  - JSON schema validation                                       │
│  - Evidence grounding check                                     │
│  - Confidence threshold filtering                               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STRUCTURED OUTPUT                             │
│  - Health scores                                                │
│  - Prioritized issues                                           │
│  - Inline comments                                              │
│  - Suggested fixes                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Finding Aggregation

**Input**: Raw findings from all analyzers
**Output**: Normalized, deduplicated findings

```python
class FindingAggregator:
    def aggregate(self, raw_findings: List[Dict]) -> List[Finding]:
        # 1. Normalize severities
        normalized = self.normalize_severities(raw_findings)
        
        # 2. Deduplicate (same issue, different tools)
        deduplicated = self.deduplicate(normalized)
        
        # 3. Group related issues
        grouped = self.group_related(deduplicated)
        
        # 4. Attach metadata
        enriched = self.attach_metadata(grouped)
        
        return enriched
    
    def deduplicate(self, findings: List[Finding]) -> List[Finding]:
        """Merge findings that refer to the same issue."""
        # Use file + line + issue_type as key
        seen = {}
        for finding in findings:
            key = (finding.file, finding.line, finding.category)
            if key in seen:
                # Merge tools and increase confidence
                seen[key].tools.append(finding.tool)
                seen[key].confidence = max(seen[key].confidence, finding.confidence)
            else:
                seen[key] = finding
        return list(seen.values())
```

### 1.3 RAG Context Retrieval

**Vector Database**: ChromaDB (local) or Pinecone (cloud)
**Embedding Model**: `text-embedding-3-small` (OpenAI) or `sentence-transformers/all-MiniLM-L6-v2`

#### 1.3.1 Indexed Documents

1. **Repository Documentation**:
   - README.md
   - CONTRIBUTING.md
   - Style guides
   - Architecture docs
   - API documentation

2. **Historical Context**:
   - Past PR reviews (last 100 PRs)
   - Resolved issues
   - Team feedback (accepted/dismissed patterns)
   - Common patterns and conventions

3. **Code Context**:
   - Related files (imports, dependencies)
   - Function/class documentation
   - Test files
   - Configuration files

#### 1.3.2 Retrieval Strategy

```python
class RAGContextRetriever:
    def __init__(self, vector_db: VectorDB):
        self.vector_db = vector_db
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
    
    def retrieve_context(self, finding: Finding, repo_id: str) -> Dict:
        """Retrieve relevant context for a finding."""
        context = {
            'repository_docs': [],
            'similar_issues': [],
            'team_preferences': [],
            'code_context': []
        }
        
        # 1. Query repository docs
        query = f"{finding.category} {finding.title} {finding.description}"
        doc_results = self.vector_db.query(
            query_texts=[query],
            n_results=5,
            filter={'type': 'documentation', 'repo_id': repo_id}
        )
        context['repository_docs'] = doc_results['documents'][0]
        
        # 2. Query similar past issues
        issue_results = self.vector_db.query(
            query_texts=[query],
            n_results=10,
            filter={'type': 'issue', 'repo_id': repo_id, 'resolved': True}
        )
        context['similar_issues'] = issue_results['documents'][0]
        
        # 3. Query team preferences
        pref_results = self.vector_db.query(
            query_texts=[query],
            n_results=5,
            filter={'type': 'preference', 'repo_id': repo_id}
        )
        context['team_preferences'] = pref_results['documents'][0]
        
        # 4. Get code context (neighboring files)
        context['code_context'] = self.get_code_context(finding.file, repo_id)
        
        return context
```

### 1.4 LLM Reasoning

**Primary Model**: GPT-4 Turbo / Claude 3.5 Sonnet
**Fallback**: Local model (Llama 3.1 70B / Mistral)

#### 1.4.1 Prompt Template

```python
REASONING_PROMPT = """
You are an expert code reviewer analyzing findings from multiple static analysis tools.

# Repository Context
{repository_context}

# Team Preferences
{team_preferences}

# Similar Past Issues
{similar_issues}

# Current Findings
{findings}

# Task
1. Prioritize issues by risk and impact (Critical > Major > Minor)
2. Generate clear explanations grounded in evidence
3. Suggest safe, automated fixes where possible
4. Assign confidence scores (0.0-1.0)
5. Group related issues

# Output Format (JSON)
{{
  "overall_health_score": 0-100,
  "category_scores": {{
    "security": 0-100,
    "performance": 0-100,
    "code_quality": 0-100,
    "maintainability": 0-100,
    "devops": 0-100,
    "frontend": 0-100
  }},
  "prioritized_issues": [
    {{
      "id": "unique-id",
      "severity": "critical|major|minor|info",
      "category": "security|performance|...",
      "title": "Human-readable title",
      "description": "Detailed explanation with evidence",
      "file": "path/to/file",
      "line": 42,
      "confidence": 0.95,
      "evidence": ["tool1 found X", "tool2 found Y"],
      "suggested_fix": "code suggestion",
      "related_issues": ["id1", "id2"]
    }}
  ],
  "quick_wins": ["id1", "id2"],
  "top_risks": ["id1", "id2"]
}}

# Guidelines
- Every claim must be grounded in evidence from tools
- Confidence scores reflect tool reliability and evidence strength
- Only suggest fixes that are safe and automated
- Respect team preferences and past resolutions
- Avoid hallucinations - if unsure, mark confidence low
"""

def generate_reasoning(findings: List[Finding], context: Dict) -> Dict:
    prompt = REASONING_PROMPT.format(
        repository_context=format_context(context['repository_docs']),
        team_preferences=format_context(context['team_preferences']),
        similar_issues=format_context(context['similar_issues']),
        findings=format_findings(findings)
    )
    
    response = llm_client.chat.completions.create(
        model="gpt-4-turbo-preview",
        messages=[
            {"role": "system", "content": "You are an expert code reviewer."},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.2  # Low temperature for consistency
    )
    
    result = json.loads(response.choices[0].message.content)
    
    # Validate output
    validate_output(result)
    
    return result
```

#### 1.4.2 Output Validation

```python
def validate_output(output: Dict) -> None:
    """Validate LLM output against schema."""
    schema = {
        "type": "object",
        "required": ["overall_health_score", "prioritized_issues"],
        "properties": {
            "overall_health_score": {"type": "number", "minimum": 0, "maximum": 100},
            "prioritized_issues": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["id", "severity", "title", "confidence"],
                    "properties": {
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1}
                    }
                }
            }
        }
    }
    
    jsonschema.validate(instance=output, schema=schema)
    
    # Check evidence grounding
    for issue in output.get("prioritized_issues", []):
        if not issue.get("evidence"):
            raise ValidationError(f"Issue {issue['id']} missing evidence")
```

### 1.5 Confidence Scoring

Confidence scores combine:
1. **Tool Reliability**: Historical accuracy of each tool
2. **Evidence Strength**: Number of tools detecting the same issue
3. **Context Match**: How well the issue matches repository patterns
4. **Historical Feedback**: Past acceptance rate for similar issues

```python
def calculate_confidence(finding: Finding, context: Dict) -> float:
    """Calculate confidence score for a finding."""
    
    # 1. Tool reliability (from historical data)
    tool_reliability = get_tool_reliability(finding.tool)
    
    # 2. Evidence strength (multiple tools = higher confidence)
    evidence_strength = len(finding.tools) / 3.0  # Normalize to 0-1
    
    # 3. Context match (similar past issues)
    context_match = calculate_similarity(finding, context['similar_issues'])
    
    # 4. Historical feedback
    acceptance_rate = get_acceptance_rate(finding.category, finding.repo_id)
    
    # Weighted combination
    confidence = (
        0.3 * tool_reliability +
        0.3 * evidence_strength +
        0.2 * context_match +
        0.2 * acceptance_rate
    )
    
    return min(1.0, max(0.0, confidence))
```

---

## 2. MACHINE LEARNING & FINE-TUNING

### 2.1 Dataset Design

#### 2.1.1 Training Data Schema

```python
class TrainingExample:
    """Single training example for ML models."""
    repo_id: str
    pr_number: int
    commit_sha: str
    
    # Input features
    findings: List[Finding]  # Raw findings from analyzers
    code_context: Dict  # File contents, imports, etc.
    repository_metadata: Dict  # Language, framework, size
    
    # Labels
    user_feedback: Dict  # accept/dismiss/resolve/ignore
    priority_label: str  # critical/major/minor/info (ground truth)
    acceptance_label: bool  # True if accepted, False if dismissed
    
    # Metadata
    timestamp: datetime
    reviewer: str  # GitHub username
```

#### 2.1.2 Data Collection

1. **Automatic Collection**:
   - Every review generates a training example
   - User feedback (accept/dismiss) is the label
   - Store in `ml_training_data` table

2. **Data Augmentation**:
   - Synthetic examples from code patterns
   - Cross-repository transfer learning
   - Negative examples (false positives)

3. **Data Quality**:
   - Filter out ambiguous feedback
   - Require minimum 3 reviews per pattern
   - Balance classes (accept vs dismiss)

### 2.2 Models to Train

#### 2.2.1 Issue Prioritization Model

**Task**: Predict priority (critical/major/minor/info) from finding features

**Input Features**:
- Finding category (security, performance, etc.)
- Tool confidence
- Code context (complexity, file type, etc.)
- Historical patterns
- Repository metadata

**Output**: Priority class probabilities

**Model Architecture**:
```python
class PriorityClassifier(nn.Module):
    def __init__(self, input_dim=256, hidden_dim=128, num_classes=4):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim // 2, num_classes)
        )
    
    def forward(self, x):
        return self.encoder(x)
```

**Training**:
- Loss: Cross-entropy
- Optimizer: Adam (lr=1e-3)
- Epochs: 50
- Early stopping: patience=10
- Validation split: 20%

#### 2.2.2 Acceptance Prediction Model

**Task**: Predict if user will accept or dismiss an issue

**Input Features**:
- Finding features (same as priority model)
- Historical acceptance rate for similar issues
- Team preferences
- Issue context

**Output**: Acceptance probability (0-1)

**Model Architecture**: Binary classifier (similar to priority model)

**Training**:
- Loss: Binary cross-entropy
- Class weights: Balance accept/dismiss ratio
- Metrics: Precision, Recall, F1, AUC-ROC

#### 2.2.3 Repo-Specific Style Classifier

**Task**: Learn repository-specific style preferences

**Input Features**:
- Code patterns
- Style guide rules
- Past feedback

**Output**: Style rule violations (binary)

**Model Architecture**: Fine-tuned transformer (CodeBERT)

**Training Strategy**:
- Pre-train on general code style data
- Fine-tune on repository-specific feedback
- Use LoRA for efficient fine-tuning

### 2.3 Fine-Tuning Strategy

#### 2.3.1 When to Use RAG vs Fine-Tuning

| Scenario | Approach | Reason |
|----------|----------|--------|
| General code review patterns | RAG | Fast, no training needed |
| Repository-specific style | Fine-tuning | Needs adaptation |
| Team preferences | RAG + Fine-tuning | Hybrid approach |
| New languages/frameworks | RAG | Flexible, no retraining |
| High-volume, consistent patterns | Fine-tuning | Better accuracy |

#### 2.3.2 LoRA Fine-Tuning

**Why LoRA**: Efficient fine-tuning with minimal parameters

```python
from peft import LoraConfig, get_peft_model

# LoRA configuration
lora_config = LoraConfig(
    r=16,  # Rank
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],  # Attention layers
    lora_dropout=0.1,
    bias="none",
    task_type="SEQ_CLS"
)

# Apply LoRA to base model
base_model = AutoModelForSequenceClassification.from_pretrained("microsoft/codebert-base")
model = get_peft_model(base_model, lora_config)

# Train only LoRA parameters (much faster)
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset
)
trainer.train()
```

#### 2.3.3 Training Pipeline

```python
class MLTrainingPipeline:
    def train_models(self, repo_id: str = None):
        """Train all ML models."""
        
        # 1. Load training data
        dataset = self.load_training_data(repo_id)
        
        # 2. Preprocess
        features, labels = self.preprocess(dataset)
        
        # 3. Split
        train, val, test = self.split_dataset(features, labels, ratios=[0.7, 0.15, 0.15])
        
        # 4. Train priority classifier
        priority_model = self.train_priority_classifier(train, val)
        priority_metrics = self.evaluate(priority_model, test)
        
        # 5. Train acceptance predictor
        acceptance_model = self.train_acceptance_predictor(train, val)
        acceptance_metrics = self.evaluate(acceptance_model, test)
        
        # 6. Fine-tune style classifier (if repo-specific)
        if repo_id:
            style_model = self.fine_tune_style_classifier(repo_id, train, val)
            style_metrics = self.evaluate(style_model, test)
        
        # 7. Save models
        self.save_models({
            'priority': priority_model,
            'acceptance': acceptance_model,
            'style': style_model if repo_id else None
        })
        
        return {
            'priority_metrics': priority_metrics,
            'acceptance_metrics': acceptance_metrics,
            'style_metrics': style_metrics if repo_id else None
        }
```

### 2.4 Evaluation Metrics

#### 2.4.1 Priority Classification

- **Accuracy**: Overall correctness
- **Precision/Recall per class**: Critical, Major, Minor, Info
- **F1-Score**: Harmonic mean of precision and recall
- **Confusion Matrix**: Visualize misclassifications

#### 2.4.2 Acceptance Prediction

- **AUC-ROC**: Area under ROC curve
- **Precision**: Of predicted accepts, how many were actually accepted
- **Recall**: Of actual accepts, how many were predicted
- **F1-Score**: Balanced metric

#### 2.4.3 Style Classification

- **Accuracy**: Overall correctness
- **Per-rule precision/recall**: For each style rule

### 2.5 Deployment Strategy

#### 2.5.1 Model Versioning

- Use MLflow or Weights & Biases for model versioning
- Tag models with: repo_id, training_date, metrics
- A/B test new models before full deployment

#### 2.5.2 Inference

```python
class MLInferenceService:
    def __init__(self):
        self.priority_model = load_model('priority_classifier_v2.pkl')
        self.acceptance_model = load_model('acceptance_predictor_v1.pkl')
        self.style_models = {}  # Per-repo style models
    
    def predict_priority(self, finding: Finding) -> str:
        features = self.extract_features(finding)
        probabilities = self.priority_model.predict_proba([features])[0]
        return self.priority_model.classes_[np.argmax(probabilities)]
    
    def predict_acceptance(self, finding: Finding, repo_id: str) -> float:
        features = self.extract_features(finding, repo_id)
        probability = self.acceptance_model.predict_proba([features])[0][1]
        return probability
    
    def check_style_violation(self, code: str, repo_id: str) -> bool:
        if repo_id not in self.style_models:
            return False  # No repo-specific model
        model = self.style_models[repo_id]
        return model.predict([code])[0] == 1
```

#### 2.5.3 Continuous Learning

1. **Online Learning**: Update models incrementally as new feedback arrives
2. **Batch Retraining**: Weekly/monthly full retraining
3. **Drift Detection**: Monitor model performance, retrain if accuracy drops

---

## 3. PROMPT ENGINEERING

### 3.1 Prompt Templates

#### 3.1.1 Issue Explanation Prompt

```python
EXPLANATION_PROMPT = """
Explain this code issue in simple terms:

Issue: {issue_title}
Category: {category}
File: {file}:{line}
Code: {code_snippet}
Tool: {tool}

Context:
{code_context}

Similar past issues:
{past_issues}

Write a clear, actionable explanation that:
1. Describes what the issue is
2. Explains why it matters
3. Provides evidence from the code
4. Suggests a fix (if safe)
"""
```

#### 3.1.2 Fix Suggestion Prompt

```python
FIX_PROMPT = """
Suggest a safe, automated fix for this issue:

Issue: {issue_title}
Code: {code_snippet}
Context: {code_context}

Requirements:
- Fix must be safe (no breaking changes)
- Fix must be automated (can be applied automatically)
- Fix must follow repository style guide
- Include explanation of the fix

Output format:
{{
  "fix": "code replacement",
  "explanation": "why this fix works",
  "safety_score": 0.0-1.0,
  "automated": true/false
}}
"""
```

### 3.2 Few-Shot Examples

Include examples in prompts to guide LLM behavior:

```python
FEW_SHOT_EXAMPLES = """
Example 1:
Issue: SQL injection vulnerability
Code: query = f"SELECT * FROM users WHERE id = {user_id}"
Fix: query = "SELECT * FROM users WHERE id = %s"
Explanation: Use parameterized queries to prevent SQL injection.

Example 2:
Issue: N+1 query pattern
Code: for user in users: posts = get_posts(user.id)
Fix: posts = get_posts_bulk([u.id for u in users])
Explanation: Batch queries to reduce database round trips.
"""
```

---

## 4. HALLUCINATION PREVENTION

### 4.1 Evidence Grounding

Every claim must reference:
1. Tool output (e.g., "Bandit detected SQL injection")
2. Code evidence (e.g., "Line 42 uses f-string in SQL query")
3. Historical context (e.g., "Similar issue was fixed in PR #123")

### 4.2 Validation Rules

```python
def validate_explanation(explanation: str, finding: Finding) -> bool:
    """Check if explanation is grounded in evidence."""
    
    # 1. Must reference the tool
    if finding.tool.lower() not in explanation.lower():
        return False
    
    # 2. Must reference the code
    if finding.code_snippet[:20] not in explanation:
        return False
    
    # 3. Must not contain unsupported claims
    unsupported_patterns = [
        "this will definitely",
        "this always causes",
        "this is guaranteed to"
    ]
    for pattern in unsupported_patterns:
        if pattern in explanation.lower():
            return False
    
    return True
```

### 4.3 Confidence Thresholds

- **High confidence (≥0.8)**: Multiple tools agree, strong evidence
- **Medium confidence (0.5-0.8)**: Single tool, moderate evidence
- **Low confidence (<0.5)**: Weak evidence, mark as "needs review"

Only issues with confidence ≥0.5 are shown by default.

---

## 5. FEEDBACK LOOP

### 5.1 Feedback Collection

```python
@api.route('/api/feedback', methods=['POST'])
def submit_feedback():
    """Collect user feedback on issues."""
    data = request.json
    
    feedback = Feedback(
        issue_id=data['issue_id'],
        review_id=data['review_id'],
        action=data['action'],  # accept/dismiss/resolve/ignore
        user_id=current_user.id,
        timestamp=datetime.utcnow(),
        comment=data.get('comment', '')
    )
    
    db.session.add(feedback)
    db.session.commit()
    
    # Trigger model update (async)
    update_models.delay(feedback.id)
    
    return jsonify({"success": True})
```

### 5.2 Model Updates

```python
@celery.task
def update_models(feedback_id: int):
    """Update ML models with new feedback."""
    feedback = Feedback.query.get(feedback_id)
    
    # Add to training dataset
    training_example = create_training_example(feedback)
    save_training_example(training_example)
    
    # Check if retraining is needed
    if should_retrain():
        train_models.delay()
```

### 5.3 Learning Metrics

Track:
- Model accuracy over time
- Feedback distribution (accept vs dismiss)
- False positive rate
- User satisfaction (optional survey)

