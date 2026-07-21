"""Unit tests for SonarQubeReviewResponse Pydantic schema."""
import unittest


class TestSonarQubeReviewSchema(unittest.TestCase):

    def test_valid_full_schema(self):
        from backend.schemas.sonarqube_review_schema import (
            SonarQubeReviewResponse, SonarQubeEnrichedIssue, LinterReference,
        )
        response = SonarQubeReviewResponse(
            project='codebuster',
            scan_source='SonarQube + AwesomeLinters',
            issue_list=[
                SonarQubeEnrichedIssue(
                    issue_id='S2131',
                    rule='Null Pointer Risk',
                    severity='Critical',
                    file='src/UserService.java',
                    line=78,
                    description='Possible NullPointerException.',
                    recommended_fix='Add a null-check or use Optional.',
                    effort_minutes=10,
                    linters_reference=[
                        LinterReference(
                            linter_name='ESLint',
                            linter_rule_id='no-undef',
                            linter_rule_desc='Disallow use of undefined variables.',
                        ),
                    ],
                    tags=['bug', 'reliability'],
                ),
            ],
        )
        self.assertEqual(response.project, 'codebuster')
        self.assertEqual(len(response.issue_list), 1)
        self.assertEqual(response.issue_list[0].issue_id, 'S2131')
        self.assertEqual(response.issue_list[0].effort_minutes, 10)
        self.assertEqual(len(response.issue_list[0].linters_reference), 1)

    def test_empty_issue_list(self):
        from backend.schemas.sonarqube_review_schema import SonarQubeReviewResponse
        response = SonarQubeReviewResponse()
        self.assertEqual(response.project, 'codebuster')
        self.assertEqual(response.scan_source, 'SonarQube + AwesomeLinters')
        self.assertEqual(response.issue_list, [])

    def test_to_json_dict(self):
        from backend.schemas.sonarqube_review_schema import (
            SonarQubeReviewResponse, SonarQubeEnrichedIssue,
        )
        response = SonarQubeReviewResponse(
            issue_list=[
                SonarQubeEnrichedIssue(
                    issue_id='S100', rule='Test', severity='Minor',
                    file='a.py', line=1, description='desc',
                    recommended_fix='fix', effort_minutes=5,
                    tags=['style'],
                ),
            ],
        )
        d = response.to_json_dict()
        self.assertIsInstance(d, dict)
        self.assertEqual(d['project'], 'codebuster')
        self.assertEqual(len(d['issue_list']), 1)
        self.assertEqual(d['issue_list'][0]['issue_id'], 'S100')
        self.assertEqual(d['issue_list'][0]['linters_reference'], [])

    def test_linter_reference_defaults(self):
        from backend.schemas.sonarqube_review_schema import LinterReference
        ref = LinterReference()
        self.assertEqual(ref.linter_name, '')
        self.assertEqual(ref.linter_rule_id, '')
        self.assertEqual(ref.linter_rule_desc, '')

    def test_issue_defaults(self):
        from backend.schemas.sonarqube_review_schema import SonarQubeEnrichedIssue
        issue = SonarQubeEnrichedIssue()
        self.assertEqual(issue.issue_id, '')
        self.assertEqual(issue.line, 0)
        self.assertEqual(issue.effort_minutes, 0)
        self.assertEqual(issue.tags, [])
        self.assertEqual(issue.linters_reference, [])

    def test_extra_fields_allowed(self):
        from backend.schemas.sonarqube_review_schema import SonarQubeReviewResponse
        response = SonarQubeReviewResponse(extra_field='hello')
        d = response.to_json_dict()
        self.assertEqual(d.get('extra_field'), 'hello')


if __name__ == '__main__':
    unittest.main()
