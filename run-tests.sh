#!/bin/bash

# Test Runner Script for Compliant.team
# Runs frontend and backend tests

set -e  # Exit on error

echo "================================"
echo "Running Compliant.team Test Suite"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track test results
FRONTEND_PASSED=false
BACKEND_PASSED=false

# Frontend Tests
echo -e "${YELLOW}Running Frontend Tests (Vitest)...${NC}"
echo "================================"
if npm test -- --run; then
    echo -e "${GREEN}✓ Frontend tests passed${NC}"
    FRONTEND_PASSED=true
else
    echo -e "${RED}✗ Frontend tests failed${NC}"
fi
echo ""

# Backend Tests
echo -e "${YELLOW}Running Backend Tests (Pytest)...${NC}"
echo "================================"
if (cd backend-python && pytest); then
    echo -e "${GREEN}✓ Backend tests passed${NC}"
    BACKEND_PASSED=true
else
    echo -e "${RED}✗ Backend tests failed${NC}"
fi
echo ""

# Summary
echo "================================"
echo "Test Summary"
echo "================================"

if [ "$FRONTEND_PASSED" = true ]; then
    echo -e "${GREEN}✓ Frontend Tests: PASSED${NC}"
else
    echo -e "${RED}✗ Frontend Tests: FAILED${NC}"
fi

if [ "$BACKEND_PASSED" = true ]; then
    echo -e "${GREEN}✓ Backend Tests: PASSED${NC}"
else
    echo -e "${RED}✗ Backend Tests: FAILED${NC}"
fi

echo ""

# Exit with error if any tests failed
if [ "$FRONTEND_PASSED" = true ] && [ "$BACKEND_PASSED" = true ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
