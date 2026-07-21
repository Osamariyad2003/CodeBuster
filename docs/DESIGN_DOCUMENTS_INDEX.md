# CodeBuster - Design Documents Index

## Complete System Design Documentation

This repository contains comprehensive design documentation for CodeBuster, an AI-powered engineering health analysis platform.

---

## 📚 Document Overview

### Full system description (split docs)

Topic-based reference for the current CodeBuster implementation (~1000 lines total). Reuse [backend/docs/JSON_FORMATS.md](../backend/docs/JSON_FORMATS.md) and [backend/docs/UI_DESIGN_JSON_TO_SCREENS.md](../backend/docs/UI_DESIGN_JSON_TO_SCREENS.md) for JSON shapes and UI mapping.

| Doc | Path | Content |
|-----|------|---------|
| 1 | [01_OVERVIEW_AND_ARCHITECTURE.md](../backend/docs/01_OVERVIEW_AND_ARCHITECTURE.md) | Product purpose, high-level architecture, main flows (auth, scan, review), deployment/config summary |
| 2 | [02_BACKEND_REFERENCE.md](../backend/docs/02_BACKEND_REFERENCE.md) | Entry (main.py), routes by blueprint, services, models, tasks, config |
| 3 | [03_FRONTEND_REFERENCE.md](../backend/docs/03_FRONTEND_REFERENCE.md) | App structure, routes/pages, components, apiClient, auth and scan flow UI |
| 4 | [04_APIS_AND_FLOWS.md](../backend/docs/04_APIS_AND_FLOWS.md) | API surface summary, scan and review flows, references to JSON_FORMATS and UI_DESIGN |

---

### 1. [SYSTEM_DESIGN_SUMMARY.md](./SYSTEM_DESIGN_SUMMARY.md)
**Start here!** High-level overview of the entire system design.
- System architecture summary
- Key components
- Technology stack
- Success metrics
- Quick Q&A

**Read this first** to understand the big picture.

---

### 2. [ARCHITECTURE.md](./ARCHITECTURE.md)
**Complete system architecture design.**
- High-level architecture diagram
- Data flow: GitHub event → analysis → output
- Component details (API Gateway, Backend, Queue, Workers, AI Layer, Data Layer, Frontend)
- Security considerations
- Scalability & performance targets

**Read this** to understand how all components fit together.

---

### 3. [ANALYSIS_MODULES.md](./ANALYSIS_MODULES.md)
**Detailed breakdown of all 6 analysis modules.**
- **Security Analyzer**: Secrets, vulnerabilities, misconfigurations
- **Code Quality Analyzer**: Code smells, style violations, complexity
- **Performance Analyzer**: N+1 queries, hotspots, bottlenecks
- **Maintainability Analyzer**: Test coverage, hot files, dependencies
- **DevOps Analyzer**: CI/CD, Docker, IaC issues
- **Frontend DevTools Analyzer**: Network, memory, performance, Lighthouse

For each module:
- Problems detected
- Tools & techniques used
- ML/AI enhancements
- Implementation examples

**Read this** to understand what each analyzer does and how it works.

---

### 4. [AI_ML_PIPELINE.md](./AI_ML_PIPELINE.md)
**AI/ML pipeline design and machine learning strategy.**
- AI reasoning pipeline (aggregation → RAG → LLM → validation)
- RAG context retrieval (vector DB, embeddings, retrieval strategy)
- LLM reasoning (prompt templates, output validation)
- Machine learning models (priority classifier, acceptance predictor, style classifier)
- Fine-tuning strategy (RAG vs LoRA, when to use each)
- Training pipeline and evaluation metrics
- Feedback loop and continuous learning

**Read this** to understand how AI/ML enhances the analysis.

---

### 5. [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
**Complete database schema design.**
- Core tables (users, repositories, reviews, issues, feedback)
- ML tables (training data, models, training runs)
- RAG tables (documents)
- Job queue tables
- Analytics tables
- Views and functions
- Indexes and performance optimization
- Migration strategy

**Read this** to understand the data model and database design.

---

### 6. [OUTPUT_SCHEMAS.md](./OUTPUT_SCHEMAS.md)
**JSON output schemas and sample outputs.**
- Review output schema (complete review response)
- Issue schema (individual issue)
- Health score response
- Frontend DevTools output
- Inline comment format (GitHub PR)
- Analytics/stats output
- Error response schema
- JSON Schema definitions
- Sample real-world examples

**Read this** to understand the output formats and API responses.

---

### 7. [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
**Step-by-step implementation plan (MVP, V1, V2).**
- **MVP (4-6 weeks)**: Basic working system
- **V1 (8-12 weeks)**: Production-ready system
- **V2 (12+ weeks)**: Advanced features
- Milestones and deliverables for each phase
- What to fake vs fully implement
- Technology stack per phase
- Testing strategy
- Deployment strategy
- Resource requirements
- Risk mitigation

**Read this** to understand how to build the system step-by-step.

---

## 🗺️ Reading Guide

### For Architects / Tech Leads
1. Start with `SYSTEM_DESIGN_SUMMARY.md`
2. Read `ARCHITECTURE.md` for system design
3. Review `IMPLEMENTATION_PLAN.md` for build strategy

### For Developers
1. Read `SYSTEM_DESIGN_SUMMARY.md` for overview
2. Study `ANALYSIS_MODULES.md` for module details
3. Review `DATABASE_SCHEMA.md` for data model
4. Check `OUTPUT_SCHEMAS.md` for API contracts
5. Follow `IMPLEMENTATION_PLAN.md` for implementation

### For ML Engineers
1. Read `AI_ML_PIPELINE.md` (complete ML design)
2. Review `DATABASE_SCHEMA.md` (ML tables)
3. Check `OUTPUT_SCHEMAS.md` (model outputs)

### For Product Managers
1. Read `SYSTEM_DESIGN_SUMMARY.md` (overview)
2. Review `IMPLEMENTATION_PLAN.md` (timeline, resources)
3. Check `OUTPUT_SCHEMAS.md` (user-facing outputs)

---

## 📋 Quick Reference

### Key Concepts

- **RAG**: Retrieval-Augmented Generation - Uses vector DB to provide context to LLM
- **LoRA**: Low-Rank Adaptation - Efficient fine-tuning method for transformers
- **Finding Aggregation**: Deduplicates and normalizes findings from multiple analyzers
- **Evidence Grounding**: Every AI claim must reference tool output or code evidence
- **Feedback Loop**: User actions (accept/dismiss) train ML models

### Key Technologies

- **Backend**: FastAPI (V1+) or Flask (MVP)
- **Database**: PostgreSQL (V1+) or SQLite (MVP)
- **Queue**: Celery + Redis
- **Vector DB**: ChromaDB
- **LLM**: GPT-4 Turbo / Claude 3.5 Sonnet
- **ML**: scikit-learn (V1), Transformers + LoRA (V2)
- **Frontend**: React + Vite

### Analysis Modules

1. **Security**: Bandit, Semgrep, TruffleHog, Snyk
2. **Code Quality**: ESLint, Pylint, SonarQube
3. **Performance**: Profilers, query analyzers
4. **Maintainability**: Coverage tools, git analysis
5. **DevOps**: Hadolint, Checkov, TFLint
6. **Frontend DevTools**: Lighthouse, Chrome DevTools

---

## 🎯 Implementation Phases

### Phase 1: MVP (4-6 weeks)
**Goal**: Working system that analyzes PRs and posts comments
- Basic GitHub App integration
- Security + Code Quality analyzers
- GPT-4 API (no RAG, no ML)
- Simple dashboard
- SQLite database

### Phase 2: V1 (8-12 weeks)
**Goal**: Production-ready, scalable system
- All 6 analyzers
- Job queue (Celery + Redis)
- PostgreSQL database
- RAG system
- Basic ML models
- Feedback loop
- Advanced dashboard

### Phase 3: V2 (12+ weeks)
**Goal**: Advanced ML, enterprise features
- Fine-tuned transformer models
- Advanced RAG
- Frontend SDK
- Model versioning
- Enterprise features

---

## 📞 Questions?

Refer to the relevant design document:
- **Architecture questions** → `ARCHITECTURE.md`
- **Analyzer questions** → `ANALYSIS_MODULES.md`
- **AI/ML questions** → `AI_ML_PIPELINE.md`
- **Database questions** → `DATABASE_SCHEMA.md`
- **API/output questions** → `OUTPUT_SCHEMAS.md`
- **Implementation questions** → `IMPLEMENTATION_PLAN.md`

---

## ✅ Checklist for Implementation

### Before Starting
- [ ] Read `SYSTEM_DESIGN_SUMMARY.md`
- [ ] Review `ARCHITECTURE.md`
- [ ] Study `IMPLEMENTATION_PLAN.md`
- [ ] Set up development environment

### MVP Phase
- [ ] Week 1: Foundation (GitHub App, webhooks)
- [ ] Week 2: Basic analysis
- [ ] Week 3: AI integration
- [ ] Week 4: GitHub comments
- [ ] Week 5: Dashboard
- [ ] Week 6: Polish & testing

### V1 Phase
- [ ] Weeks 7-8: Infrastructure (PostgreSQL, Celery, Redis)
- [ ] Weeks 9-10: All analyzers
- [ ] Weeks 11-12: RAG system
- [ ] Weeks 13-14: ML models
- [ ] Weeks 15-16: Feedback loop
- [ ] Weeks 17-18: Advanced dashboard
- [ ] Weeks 19-20: Observability & polish

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0

