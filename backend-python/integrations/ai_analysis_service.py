"""
AI Analysis Service using OpenAI and other LLM providers
Analyzes insurance documents for compliance, extracts data, and provides recommendations
Equivalent to Node.js backend's ai-analysis-service.js
"""
import os
import json
import logging
from typing import Dict, Any, List, Optional
import httpx

logger = logging.getLogger(__name__)


class AIAnalysisService:
    """Service for AI-powered insurance document analysis"""
    
    def __init__(self):
        self.provider = os.environ.get("AI_PROVIDER", "openai")
        self.api_key = os.environ.get("AI_API_KEY") or os.environ.get("OPENAI_API_KEY")
        self.model = os.environ.get("AI_MODEL", "gpt-4-turbo-preview")
        self.enabled = bool(self.api_key)
        
        if self.enabled:
            logger.info(f"AI Analysis Service enabled with provider: {self.provider}, model: {self.model}")
        else:
            logger.warning("AI Analysis Service disabled - set AI_API_KEY to enable")
    
    async def analyze_coi_compliance(self, coi_data: Dict[str, Any], requirements: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Analyze a COI for compliance with project requirements
        
        Args:
            coi_data: Extracted COI data
            requirements: Project insurance requirements
            
        Returns:
            Dictionary with analysis, deficiencies, and recommendations
        """
        try:
            logger.info("Analyzing COI for compliance")
            
            if not self.enabled:
                return self._get_mock_compliance_analysis(coi_data)
            
            prompt = self._build_compliance_prompt(coi_data, requirements or {})
            response = await self._call_ai(prompt)
            
            return self._parse_compliance_response(response, coi_data)
            
        except Exception as e:
            logger.error(f"COI compliance analysis failed: {str(e)}", exc_info=True)
            return self._get_mock_compliance_analysis(coi_data)
    
    async def extract_policy_data(self, policy_text: str, policy_type: str = "gl") -> Dict[str, Any]:
        """
        Extract structured data from insurance policy text
        
        Args:
            policy_text: Raw text from policy document
            policy_type: Type of policy (gl, wc, umbrella, auto)
            
        Returns:
            Structured policy data
        """
        try:
            logger.info(f"Extracting policy data for type: {policy_type}")
            
            if not self.enabled:
                return self._get_mock_policy_data(policy_type)
            
            prompt = f"""Extract structured data from this {policy_type} insurance policy. Return valid JSON with:
{{
  "policy_number": "",
  "effective_date": "YYYY-MM-DD",
  "expiration_date": "YYYY-MM-DD",
  "insurer_name": "",
  "coverage_type": "{policy_type.upper()}",
  "limits": {{
    "each_occurrence": "",
    "aggregate": "",
    "per_claim": ""
  }},
  "deductibles": {{
    "standard": "",
    "medical_only": ""
  }},
  "additional_insureds": [],
  "waiver_of_subrogation": true/false,
  "endorsements": []
}}

Policy text:
{policy_text[:2000]}"""
            
            response = await self._call_ai(prompt)
            return self._parse_json(response)
            
        except Exception as e:
            logger.error(f"Policy data extraction failed: {str(e)}", exc_info=True)
            return self._get_mock_policy_data(policy_type)
    
    async def generate_recommendations(self, coi_data: Dict[str, Any], deficiencies: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Generate review recommendations for admin reviewer
        
        Args:
            coi_data: COI data
            deficiencies: List of identified deficiencies
            
        Returns:
            List of recommendations
        """
        try:
            logger.info(f"Generating review recommendations with {len(deficiencies or [])} deficiencies")
            
            if not self.enabled:
                return self._get_mock_recommendations()
            
            deficiency_text = "\n".join([
                f"- {d.get('title', 'Unknown')}: {d.get('description', '')}"
                for d in (deficiencies or [])
            ])
            
            prompt = f"""As an insurance compliance expert, review this COI and provide specific recommendations:

COI Summary:
- Subcontractor: {coi_data.get('subcontractor_name', 'Unknown')}
- Project: {coi_data.get('project_name', 'Unknown')}

Identified Deficiencies:
{deficiency_text or "None identified"}

Provide 3-5 specific, actionable recommendations for the admin reviewer.
Return as JSON array with format:
[
  {{
    "priority": "high|medium|low",
    "action": "approve|request_revision|reject",
    "reason": "brief explanation",
    "details": "specific steps or information needed"
  }}
]"""
            
            response = await self._call_ai(prompt)
            return self._parse_json(response)
            
        except Exception as e:
            logger.error(f"Recommendation generation failed: {str(e)}", exc_info=True)
            return self._get_mock_recommendations()
    
    async def _call_ai(self, prompt: str, max_tokens: int = 1500) -> str:
        """
        Call AI provider API
        
        Args:
            prompt: The prompt to send
            max_tokens: Maximum tokens in response
            
        Returns:
            AI response text
        """
        if self.provider == "openai":
            return await self._call_openai(prompt, max_tokens)
        else:
            logger.warning(f"Unsupported AI provider: {self.provider}")
            return "{}"
    
    async def _call_openai(self, prompt: str, max_tokens: int = 1500) -> str:
        """Call OpenAI API"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are an expert insurance compliance analyst. Provide accurate, detailed analysis in JSON format."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.3
                },
                timeout=30.0
            )
            
            response.raise_for_status()
            data = response.json()
            
            return data["choices"][0]["message"]["content"]
    
    def _build_compliance_prompt(self, coi_data: Dict[str, Any], requirements: Dict[str, Any]) -> str:
        """Build compliance analysis prompt"""
        return f"""Analyze this Certificate of Insurance (COI) for compliance with project requirements.

COI Information:
{json.dumps(coi_data, indent=2)}

Project Requirements:
{json.dumps(requirements, indent=2)}

Provide analysis in this JSON format:
{{
  "compliant": true/false,
  "compliance_score": 0-100,
  "deficiencies": [
    {{
      "severity": "critical|high|medium|low",
      "category": "coverage|limits|dates|endorsements",
      "title": "Brief title",
      "description": "Detailed description",
      "requirement": "What was required",
      "actual": "What was provided"
    }}
  ],
  "strengths": ["List of things done correctly"],
  "overall_assessment": "Brief summary"
}}"""
    
    def _parse_compliance_response(self, response: str, coi_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse AI compliance response"""
        try:
            parsed = json.loads(response)
            return {
                "analysis": parsed,
                "deficiencies": parsed.get("deficiencies", []),
                "recommendations": parsed.get("strengths", [])
            }
        except json.JSONDecodeError:
            logger.warning("Failed to parse AI response as JSON, using mock data")
            return self._get_mock_compliance_analysis(coi_data)
    
    def _parse_json(self, response: str) -> Any:
        """Parse JSON response from AI"""
        try:
            # Try to find JSON in response
            start = response.find("{")
            end = response.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response[start:end])
            
            # Try array format
            start = response.find("[")
            end = response.rfind("]") + 1
            if start >= 0 and end > start:
                return json.loads(response[start:end])
            
            return json.loads(response)
        except json.JSONDecodeError:
            logger.warning("Failed to parse AI response as JSON")
            return {}
    
    def _get_mock_compliance_analysis(self, coi_data: Dict[str, Any]) -> Dict[str, Any]:
        """Return mock compliance analysis for development"""
        return {
            "analysis": {
                "compliant": True,
                "compliance_score": 85,
                "deficiencies": [
                    {
                        "severity": "medium",
                        "category": "endorsements",
                        "title": "Waiver of Subrogation not clearly stated",
                        "description": "The COI should explicitly state that waiver of subrogation is included",
                        "requirement": "Waiver of Subrogation endorsement",
                        "actual": "Not explicitly stated on certificate"
                    }
                ],
                "strengths": [
                    "All required coverage types present",
                    "Coverage limits meet or exceed requirements",
                    "Policy periods are current and valid",
                    "Additional insured endorsement included"
                ],
                "overall_assessment": "The certificate is generally compliant with minor documentation improvements needed."
            },
            "deficiencies": [
                {
                    "severity": "medium",
                    "category": "endorsements",
                    "title": "Waiver of Subrogation not clearly stated",
                    "description": "The COI should explicitly state that waiver of subrogation is included"
                }
            ],
            "recommendations": [
                "Request explicit waiver of subrogation statement",
                "Verify additional insured wording with carrier",
                "Confirm primary and non-contributory status"
            ]
        }
    
    def _get_mock_policy_data(self, policy_type: str) -> Dict[str, Any]:
        """Return mock policy data for development"""
        return {
            "policy_number": f"{policy_type.upper()}-2026-123456",
            "effective_date": "2026-01-01",
            "expiration_date": "2027-01-01",
            "insurer_name": "Sample Insurance Company",
            "coverage_type": policy_type.upper(),
            "limits": {
                "each_occurrence": "$1,000,000",
                "aggregate": "$2,000,000",
                "per_claim": "$1,000,000"
            },
            "deductibles": {
                "standard": "$5,000",
                "medical_only": "$1,000"
            },
            "additional_insureds": ["General Contractor", "Project Owner"],
            "waiver_of_subrogation": True,
            "endorsements": [
                "Additional Insured - Primary and Non-Contributory",
                "Waiver of Subrogation"
            ]
        }
    
    def _get_mock_recommendations(self) -> List[Dict[str, Any]]:
        """Return mock recommendations for development"""
        return [
            {
                "priority": "high",
                "action": "request_revision",
                "reason": "Waiver of subrogation not clearly documented",
                "details": "Request updated certificate with explicit waiver of subrogation endorsement reference"
            },
            {
                "priority": "medium",
                "action": "approve",
                "reason": "All major requirements met",
                "details": "Coverage limits and types meet project requirements. Proceed with conditional approval."
            },
            {
                "priority": "low",
                "action": "approve",
                "reason": "Documentation quality is good",
                "details": "Certificate is well-formatted and contains all standard information"
            }
        ]
