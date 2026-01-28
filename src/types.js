/**
 * @fileoverview Type definitions for Compliant4 application
 * @description JSDoc type definitions for improved IDE support and type safety
 * without the complexity of TypeScript
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * @typedef {Object} User
 * @property {string} id - Unique user identifier
 * @property {string} username - Username for authentication
 * @property {string} email - User email address
 * @property {('super_admin'|'admin'|'gc_user'|'contractor'|'broker')} role - User role
 * @property {string} [company_id] - Associated company ID
 * @property {boolean} active - Whether user is active
 * @property {string} created_at - ISO 8601 timestamp
 * @property {string} updated_at - ISO 8601 timestamp
 */

/**
 * @typedef {Object} Contractor
 * @property {string} id - Unique contractor identifier
 * @property {string} company_name - Company name
 * @property {('general_contractor'|'subcontractor')} contractor_type - Type of contractor
 * @property {string} email - Contact email
 * @property {string} [phone] - Contact phone
 * @property {('active'|'inactive'|'pending')} status - Contractor status
 * @property {string} created_at - ISO 8601 timestamp
 */

/**
 * @typedef {Object} Project
 * @property {string} id - Unique project identifier
 * @property {string} name - Project name
 * @property {string} gc_id - General contractor ID
 * @property {string} [location] - Project location
 * @property {number} [budget] - Project budget
 * @property {string} [start_date] - ISO 8601 date
 * @property {string} [end_date] - ISO 8601 date
 * @property {('active'|'completed'|'on_hold')} status - Project status
 */

/**
 * @typedef {Object} InsuranceDocument
 * @property {string} id - Document identifier
 * @property {string} subcontractor_id - Subcontractor ID
 * @property {string} project_id - Project ID
 * @property {('coi'|'policy'|'endorsement'|'other')} document_type - Document type
 * @property {string} file_url - URL to document file
 * @property {string} expiration_date - ISO 8601 date
 * @property {('pending'|'approved'|'rejected')} approval_status - Approval status
 * @property {string} uploaded_at - ISO 8601 timestamp
 */

// ============================================================================
// API TYPES
// ============================================================================

/**
 * @typedef {Object} ApiResponse
 * @template T
 * @property {boolean} success - Whether request was successful
 * @property {T} [data] - Response data
 * @property {string} [error] - Error message if failed
 * @property {string} [message] - Additional message
 */

/**
 * @typedef {Object} PaginatedResponse
 * @template T
 * @property {T[]} data - Array of items
 * @property {number} total - Total count
 * @property {number} page - Current page
 * @property {number} perPage - Items per page
 * @property {number} totalPages - Total pages
 */

/**
 * @typedef {Object} AuthTokens
 * @property {string} accessToken - JWT access token
 * @property {string} refreshToken - JWT refresh token
 * @property {number} expiresIn - Token expiration in seconds
 */

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

/**
 * @typedef {Object} ButtonProps
 * @property {('default'|'destructive'|'outline'|'secondary'|'ghost'|'link')} [variant] - Button variant
 * @property {('default'|'sm'|'lg'|'icon')} [size] - Button size
 * @property {boolean} [asChild] - Render as child component
 * @property {string} [className] - Additional CSS classes
 * @property {React.ReactNode} children - Button content
 */

/**
 * @typedef {Object} BadgeProps
 * @property {('default'|'secondary'|'destructive'|'outline')} [variant] - Badge variant
 * @property {string} [className] - Additional CSS classes
 * @property {React.ReactNode} children - Badge content
 */

/**
 * @typedef {Object} CardProps
 * @property {string} [className] - Additional CSS classes
 * @property {React.ReactNode} children - Card content
 */

// ============================================================================
// FORM TYPES
// ============================================================================

/**
 * @typedef {Object} FormFieldProps
 * @property {string} name - Field name
 * @property {Function} control - React Hook Form control
 * @property {Function} render - Render function
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} success - Whether validation passed
 * @property {Object} [data] - Validated data
 * @property {Array<{field: string, message: string}>} [errors] - Validation errors
 */

// ============================================================================
// HEALTH CHECK TYPES
// ============================================================================

/**
 * @typedef {('healthy'|'degraded'|'unhealthy')} HealthStatus
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {HealthStatus} status - Overall health status
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {number} [responseTime] - Response time in ms
 * @property {Object} [system] - System metrics
 * @property {Object} [process] - Process metrics
 * @property {Object} [checks] - Individual health checks
 */

// ============================================================================
// MONITORING TYPES
// ============================================================================

/**
 * @typedef {Object} PerformanceMetrics
 * @property {string} operation - Operation name
 * @property {number} duration - Duration in ms
 * @property {Object} [metadata] - Additional metadata
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {string} [warning] - Warning message if threshold exceeded
 */

/**
 * @typedef {Object} ErrorRecord
 * @property {string} id - Error identifier
 * @property {string} message - Error message
 * @property {string} stack - Stack trace
 * @property {string} name - Error name
 * @property {string} [code] - Error code
 * @property {Object} context - Error context
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {string} environment - Environment (development/production)
 */

/**
 * @typedef {Object} RequestLog
 * @property {string} requestId - Unique request identifier
 * @property {string} method - HTTP method
 * @property {string} path - Request path
 * @property {number} statusCode - Response status code
 * @property {number} duration - Request duration in ms
 * @property {string} ip - Client IP address
 * @property {string} userAgent - User agent string
 * @property {string} timestamp - ISO 8601 timestamp
 */

// ============================================================================
// SECURITY TYPES
// ============================================================================

/**
 * @typedef {Object} RateLimitConfig
 * @property {number} windowMs - Time window in milliseconds
 * @property {number} max - Maximum requests per window
 * @property {string} message - Error message when limit exceeded
 * @property {boolean} [standardHeaders] - Use standard rate limit headers
 * @property {boolean} [legacyHeaders] - Use legacy rate limit headers
 * @property {boolean} [skipSuccessfulRequests] - Don't count successful requests
 */

/**
 * @typedef {Object} SecurityAuditLog
 * @property {string} id - Log entry identifier
 * @property {string} event - Event type (e.g., 'user.login')
 * @property {string} userId - User who triggered event
 * @property {Object} details - Event details
 * @property {string} ip - Client IP address
 * @property {string} timestamp - ISO 8601 timestamp
 */

// ============================================================================
// QUERY & MUTATION TYPES
// ============================================================================

/**
 * @typedef {Object} UseQueryResult
 * @template T
 * @property {T} [data] - Query data
 * @property {Error} [error] - Query error
 * @property {boolean} isLoading - Loading state
 * @property {boolean} isError - Error state
 * @property {boolean} isSuccess - Success state
 * @property {Function} refetch - Refetch function
 */

/**
 * @typedef {Object} UseMutationResult
 * @template T
 * @property {Function} mutate - Mutation function
 * @property {Function} mutateAsync - Async mutation function
 * @property {T} [data] - Mutation data
 * @property {Error} [error] - Mutation error
 * @property {boolean} isLoading - Loading state
 * @property {boolean} isError - Error state
 * @property {boolean} isSuccess - Success state
 * @property {Function} reset - Reset mutation state
 */

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * @template T
 * @typedef {T | null | undefined} Maybe
 */

/**
 * @template T
 * @typedef {Promise<T>} AsyncResult
 */

/**
 * @typedef {Object} KeyValuePair
 * @property {string} key - Key
 * @property {*} value - Value
 */

// Export for JSDoc reference
export {};
