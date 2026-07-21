"""Coverage Analyzer - parses Cobertura XML and other coverage formats for maintainability insights."""
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
import structlog

logger = structlog.get_logger()

class CoverageAnalyzer:
    """
    Analyzes code coverage reports (e.g., Cobertura XML) to identify untested logic.
    Provides maintainability insights as per industry standards (BrowserStack/Cobertura).
    """

    def analyze(self, files: List[Dict[str, Any]], coverage_report_content: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Main entry point for coverage analysis.
        
        Args:
            files: List of PR files.
            coverage_report_content: Raw XML string (Cobertura, OpenClover, or JaCoCo).
            
        Returns:
            List of findings for untested or low-coverage files.
        """
        if not coverage_report_content:
            return []

        try:
            root = ET.fromstring(coverage_report_content)
            # Detect format
            if root.tag == 'report':
                return self._parse_jacoco(root, files)
            elif root.tag == 'coverage' and root.find('project') is not None:
                return self._parse_clover(root, files)
            elif root.tag == 'coverage' or root.find('packages') is not None:
                return self._parse_cobertura(root, files)
            else:
                logger.warning("unsupported_coverage_format", tag=root.tag)
                return []
        except ET.ParseError as e:
            logger.error("coverage_xml_parse_failure", error=str(e))
            return []
        except Exception as e:
            logger.error("coverage_analysis_failed", error=str(e))
            return []

    def _parse_jacoco(self, root: ET.Element, pr_files: List[Dict]) -> List[Dict]:
        """Parses JaCoCo XML and filters for files present in the current PR."""
        findings = []
        pr_file_paths = {f.get('path') for f in pr_files}
        
        # jacoco structure: package -> class -> sourcefile
        for package in root.findall("package"):
            for sourcefile in package.findall("sourcefile"):
                file_name = sourcefile.get("name")
                package_name = package.get("name", "").replace("/", ".")
                # Try to reconstruct path or match filename
                matched_path = next((p for p in pr_file_paths if file_name in p), None)
                
                if not matched_path:
                    continue

                counters = sourcefile.findall("counter")
                line_counter = next((c for c in counters if c.get("type") == "LINE"), None)
                
                if line_counter is not None:
                    missed = float(line_counter.get("missed", 0))
                    covered = float(line_counter.get("covered", 0))
                    total = missed + covered
                    
                    if total > 0:
                        coverage_rate = covered / total
                        if coverage_rate < 0.8:
                            findings.append({
                                'module': 'maintainability',
                                'severity': 'major' if coverage_rate < 0.5 else 'minor',
                                'category': 'low_test_coverage',
                                'title': f'Low Test Coverage (JaCoCo): {int(coverage_rate * 100)}%',
                                'description': f'File "{matched_path}" (Package: {package_name}) has low test coverage detected by JaCoCo.',
                                'file': matched_path,
                                'line': 1,
                                'code_snippet': f'# Lines Covered: {int(covered)} | Missed: {int(missed)}',
                                'tool': 'jacoco_analyzer',
                                'confidence': 1.0,
                                'evidence': [
                                    f"Coverage Rate: {coverage_rate:.2f}",
                                    f"Total Lines: {int(total)}",
                                    f"Package: {package_name}"
                                ],
                                'suggested_fix': {
                                    'code': '# Add unit tests to cover missing lines',
                                    'explanation': 'Follow the JaCoCo report to identify uncovered branches and statements.',
                                    'safety_score': 1.0,
                                    'automated': False
                                },
                                'references': ['JaCoCo Documentation', 'EclEmma Project']
                            })
        return findings

    def _parse_clover(self, root: ET.Element, pr_files: List[Dict]) -> List[Dict]:
        """Parses OpenClover XML and filters for files present in the current PR."""
        findings = []
        pr_file_paths = {f.get('path') for f in pr_files}
        
        # clover structure: project -> package -> file
        for file_tag in root.findall(".//file"):
            file_path = file_tag.get("name")
            
            # Match against PR files (handling potential path differences)
            matched_path = next((p for p in pr_file_paths if p in (file_path or "")), None)
            if not matched_path:
                continue

            metrics = file_tag.find("metrics")
            if metrics is None:
                continue

            elements = float(metrics.get("elements", 0))
            covered = float(metrics.get("coveredelements", 0))
            
            if elements > 0:
                coverage_rate = covered / elements
                
                if coverage_rate < 0.8:
                    findings.append({
                        'module': 'maintainability',
                        'severity': 'major' if coverage_rate < 0.5 else 'minor',
                        'category': 'low_test_coverage',
                        'title': f'Low Test Coverage (OpenClover): {int(coverage_rate * 100)}%',
                        'description': f'File "{matched_path}" has low coverage detected by OpenClover. Coverage is {int(coverage_rate * 100)}%, threshold is 80%.',
                        'file': matched_path,
                        'line': 1,
                        'code_snippet': f'# Elements: {int(elements)} | Covered: {int(covered)}',
                        'tool': 'openclover_analyzer',
                        'confidence': 1.0,
                        'evidence': [
                            f"Coverage Rate: {coverage_rate:.2f}",
                            f"Total Elements: {int(elements)}",
                            f"Covered Elements: {int(covered)}"
                        ],
                        'suggested_fix': {
                            'code': '# Increase test coverage',
                            'explanation': 'Add more unit tests for the uncovered branches and statements in this file.',
                            'safety_score': 1.0,
                            'automated': False
                        },
                        'references': ['OpenClover Documentation', 'BrowserStack Code Coverage Guide']
                    })
        return findings

    def _parse_cobertura(self, root: ET.Element, pr_files: List[Dict]) -> List[Dict]:
        """Parses Cobertura XML and filters for files present in the current PR."""
        findings = []
        pr_file_paths = {f.get('path') for f in pr_files}
        
        # Cobertura structure: packages -> package -> classes -> class
        for cls in root.findall(".//class"):
            file_path = cls.get("filename")
            
            # We only care about coverage for files modified in this PR
            if file_path not in pr_file_paths:
                continue

            line_rate = float(cls.get("line-rate", 1.0))
            branch_rate = float(cls.get("branch-rate", 1.0))
            
            # Threshold: 80% coverage (Common industry standard)
            if line_rate < 0.8:
                findings.append({
                    'module': 'maintainability',
                    'severity': 'major' if line_rate < 0.5 else 'minor',
                    'category': 'low_test_coverage',
                    'title': f'Low Test Coverage: {int(line_rate * 100)}%',
                    'description': f'File "{file_path}" has significantly low test coverage as reported by Cobertura.',
                    'file': file_path,
                    'line': 1,
                    'code_snippet': f'# Line Coverage: {line_rate*100:.1f}% | Branch Coverage: {branch_rate*100:.1f}%',
                    'tool': 'cobertura_analyzer',
                    'confidence': 1.0,
                    'evidence': [
                        f"Line Rate: {line_rate}",
                        f"Branch Rate: {branch_rate}"
                    ],
                    'suggested_fix': {
                        'code': '# Add unit/integration tests for this module',
                        'explanation': 'Improve test coverage to at least 80% to ensure code reliability and easier maintenance.',
                        'safety_score': 1.0,
                        'automated': False
                    },
                    'references': ['BrowserStack Code Coverage Guide', 'Cobertura Standards']
                })
                
        return findings
