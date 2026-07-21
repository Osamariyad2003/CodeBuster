from celery_init import celery_app
from models import db, Review, Issue, Repository
from services.review_orchestrator import ReviewOrchestrator
from datetime import datetime
import uuid
import structlog
from main import app # For DB context

logger = structlog.get_logger()

@celery_app.task(bind=True, name='tasks.analysis_tasks.run_code_analysis')
def run_code_analysis(self, files, repository_id=None):
    """
    Background task to run code analysis.
    """
    job_id = self.request.id
    request_id = getattr(self.request, 'id', str(uuid.uuid4()))
    logger.info("starting_analysis_task", 
                job_id=job_id, 
                repository_id=repository_id,
                request_id=request_id)
    
    with app.app_context():
        try:
            # Update review status to processing if it exists
            review = None
            if repository_id:
                review = Review.query.filter_by(id=job_id).first()
                if review:
                    review.status = 'processing'
                    db.session.commit()

            # Run actual orchestration
            orchestrator = ReviewOrchestrator()
            # Fetch repo context if repository_id provided
            repository_context = None
            if repository_id:
                repo = Repository.query.get(repository_id)
                if repo:
                    repository_context = {
                        'installation_id': repo.installation_id,
                        'full_name': repo.full_name,
                        'repo_id': repo.id
                    }

            result = orchestrator.analyze(files, repository_context=repository_context)

            # Update database
            if review:
                review.status = 'completed'
                review.overall_health_score = result['overall_health_score']
                review.completed_at = datetime.utcnow()
                review.set_category_scores(result['category_scores'])
                review.set_findings_count(result['summary'])
                
                # Save issues
                for issue_data in result['prioritized_issues']:
                    issue = Issue(
                        id=str(uuid.uuid4()),
                        review_id=review.id,
                        module=issue_data.get('module', 'unknown'),
                        severity=issue_data.get('severity', 'minor'),
                        category=issue_data.get('category'),
                        title=issue_data.get('title', 'Unknown'),
                        description=issue_data.get('description'),
                        file_path=issue_data.get('file', 'unknown'),
                        line_number=issue_data.get('line'),
                        code_snippet=issue_data.get('code_snippet'),
                        tool=issue_data.get('tool', 'unknown'),
                        confidence=issue_data.get('confidence', 0.5),
                        priority_score=issue_data.get('priority_score', 50)
                    )
                    issue.set_evidence(issue_data.get('evidence', []))
                    issue.set_suggested_fix(issue_data.get('suggested_fix', {}))
                    db.session.add(issue)
                
                db.session.commit()
            
            logger.info("analysis_task_completed", job_id=job_id)
            return {"status": "success", "review_id": job_id}

        except Exception as e:
            logger.error("analysis_task_failed", 
                         job_id=job_id, 
                         error=str(e),
                         exc_info=True)
            if review:
                review.status = 'failed'
                db.session.commit()
            
            # Use exponential backoff for retries
            raise self.retry(exc=e, countdown=2 ** self.request.retries * 60, max_retries=3)
