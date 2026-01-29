"""
Tests for PDF service date validation logic
Tests the critical date validation bugs:
1. Date comparison should use <= not <
2. Invalid date formats should set compliant = False
"""
import pytest
import os
import sys
from datetime import datetime, timezone, timedelta

# Add backend-python to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.pdf_service import analyze_coi_compliance


class TestDateValidationBugs:
    """Test suite for date validation logic bugs"""
    
    def test_gl_expiration_on_expiration_date(self):
        """
        Bug 1: GL policy expiring TODAY should still be valid
        Current bug: Uses < comparison, marks as expired at midnight
        Fix: Should use <= comparison to expire AFTER the date
        """
        # Create a date that expires today (at end of day)
        today = datetime.now(timezone.utc)
        expiration_date = today.replace(hour=23, minute=59, second=59).isoformat()
        
        coi_data = {
            "gl_limits_per_occurrence": 1000000,
            "gl_expiration_date": expiration_date
        }
        program_requirements = []
        
        result = analyze_coi_compliance(coi_data, program_requirements)
        
        # Policy expiring today should still be COMPLIANT
        assert result["compliant"] == True, "Policy expiring today should be valid"
        assert len([i for i in result["issues"] if i["type"] == "coverage_expired"]) == 0
    
    def test_gl_expiration_yesterday(self):
        """GL policy that expired yesterday should be non-compliant"""
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        expiration_date = yesterday.isoformat()
        
        coi_data = {
            "gl_limits_per_occurrence": 1000000,
            "gl_expiration_date": expiration_date
        }
        program_requirements = []
        
        result = analyze_coi_compliance(coi_data, program_requirements)
        
        # Policy expired yesterday should be NON-COMPLIANT
        assert result["compliant"] == False, "Expired policy should be non-compliant"
        expired_issues = [i for i in result["issues"] if i["type"] == "coverage_expired"]
        assert len(expired_issues) == 1
        assert expired_issues[0]["coverage_type"] == "General Liability"
    
    def test_wc_expiration_on_expiration_date(self):
        """
        Bug 2: WC policy expiring TODAY should still be valid
        Current bug: Uses < comparison, marks as expired at midnight
        Fix: Should use <= comparison to expire AFTER the date
        """
        # Create a date that expires today (at end of day)
        today = datetime.now(timezone.utc)
        expiration_date = today.replace(hour=23, minute=59, second=59).isoformat()
        
        coi_data = {
            "gl_limits_per_occurrence": 1000000,
            "wc_expiration_date": expiration_date
        }
        program_requirements = []
        
        result = analyze_coi_compliance(coi_data, program_requirements)
        
        # Policy expiring today should still be COMPLIANT
        assert result["compliant"] == True, "WC policy expiring today should be valid"
        assert len([i for i in result["issues"] if i["type"] == "coverage_expired"]) == 0
    
    def test_wc_expiration_yesterday(self):
        """WC policy that expired yesterday should be non-compliant"""
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        expiration_date = yesterday.isoformat()
        
        coi_data = {
            "gl_limits_per_occurrence": 1000000,
            "wc_expiration_date": expiration_date
        }
        program_requirements = []
        
        result = analyze_coi_compliance(coi_data, program_requirements)
        
        # Policy expired yesterday should be NON-COMPLIANT
        assert result["compliant"] == False, "Expired WC policy should be non-compliant"
        expired_issues = [i for i in result["issues"] if i["type"] == "coverage_expired"]
        assert len(expired_issues) == 1
        assert expired_issues[0]["coverage_type"] == "Workers Compensation"
    
    def test_gl_invalid_date_format_should_fail_compliance(self):
        """
        Bug 3: Invalid GL date format should set compliant = False
        Current bug: Only logs warning, compliant stays True (SECURITY RISK)
        Fix: Must set compliant = False when date cannot be parsed
        """
        coi_data = {
            "gl_limits_per_occurrence": 1000000,
            "gl_expiration_date": "invalid-date-format"
        }
        program_requirements = []
        
        result = analyze_coi_compliance(coi_data, program_requirements)
        
        # CRITICAL: Invalid date must fail compliance check
        assert result["compliant"] == False, "Invalid GL date format MUST fail compliance"
        invalid_issues = [i for i in result["issues"] if i["type"] == "invalid_date_format"]
        assert len(invalid_issues) == 1
        assert invalid_issues[0]["coverage_type"] == "General Liability"
    
    def test_wc_invalid_date_format_should_fail_compliance(self):
        """
        Bug 4: Invalid WC date format should set compliant = False
        Current bug: Only logs warning, compliant stays True (SECURITY RISK)
        Fix: Must set compliant = False when date cannot be parsed
        """
        coi_data = {
            "gl_limits_per_occurrence": 1000000,
            "wc_expiration_date": "not-a-real-date"
        }
        program_requirements = []
        
        result = analyze_coi_compliance(coi_data, program_requirements)
        
        # CRITICAL: Invalid date must fail compliance check
        assert result["compliant"] == False, "Invalid WC date format MUST fail compliance"
        invalid_issues = [i for i in result["issues"] if i["type"] == "invalid_date_format"]
        assert len(invalid_issues) == 1
        assert invalid_issues[0]["coverage_type"] == "Workers Compensation"
    
    def test_both_invalid_dates_should_fail_compliance(self):
        """Both GL and WC with invalid dates should fail compliance"""
        coi_data = {
            "gl_limits_per_occurrence": 1000000,
            "gl_expiration_date": "bad-gl-date",
            "wc_expiration_date": "bad-wc-date"
        }
        program_requirements = []
        
        result = analyze_coi_compliance(coi_data, program_requirements)
        
        # CRITICAL: Both invalid dates must fail compliance
        assert result["compliant"] == False, "Both invalid dates MUST fail compliance"
        invalid_issues = [i for i in result["issues"] if i["type"] == "invalid_date_format"]
        assert len(invalid_issues) == 2, "Should have 2 invalid date issues"
    
    def test_valid_future_dates_should_pass(self):
        """Valid future expiration dates should pass compliance"""
        future = datetime.now(timezone.utc) + timedelta(days=30)
        expiration_date = future.isoformat()
        
        coi_data = {
            "gl_limits_per_occurrence": 1000000,
            "gl_expiration_date": expiration_date,
            "wc_expiration_date": expiration_date
        }
        program_requirements = []
        
        result = analyze_coi_compliance(coi_data, program_requirements)
        
        # Valid future dates should be compliant
        assert result["compliant"] == True, "Valid future dates should pass"
        assert len(result["issues"]) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
