# Document Replacement Feature

## Overview
This feature allows brokers to replace already-approved insurance documents. When a document is replaced, the system automatically:
- Changes the subcontractor status from "Compliant" to "Pending Review"
- Notifies all General Contractors (GCs) associated with the project
- Updates all relevant compliance records
- Maintains an audit trail of the replacement

## Use Cases
- Broker discovers an error in an approved document
- Insurance policy coverage amounts change
- New endorsements are added to existing policies
- Policy carrier updates the document format
- Corrections are needed after approval

## How It Works

### For Brokers

1. **Access Your Dashboard**
   - Navigate to your broker dashboard (link provided in email)
   - View all your certificate requests

2. **Find Approved Documents**
   - Look for documents with status "Active" (green badge)
   - These will have both a "View" and "Replace" button

3. **Replace a Document**
   - Click the amber "Replace" button
   - A dialog will open with a warning message
   - Enter a clear reason for the replacement (required)
   - Example: "Updated coverage amounts from $1M to $2M per occurrence"
   - Click "Replace Document"

4. **After Replacement**
   - The system processes the request immediately
   - All GCs on the project receive email notifications
   - The document status changes to "Pending Review"
   - You can upload the new document through the normal workflow

### For General Contractors (GCs)

1. **Receive Notifications**
   - Email notification sent immediately when broker replaces document
   - In-app notification appears at top of your GC Dashboard
   - Notification includes:
     - Subcontractor name
     - Document type
     - Broker information
     - Reason for replacement
     - Date of replacement

2. **Review the Notification**
   - Log into your GC Dashboard
   - Amber alert banner appears at the top
   - Shows "⚠️ Document Re-Review Required"
   - Read the details to understand what changed

3. **Take Action**
   - Click through to the project to review the new document
   - Approve or reject the new document as appropriate
   - Dismiss the notification once reviewed

4. **Dismiss Notifications**
   - Click the "X" button on the notification
   - Marks the notification as read
   - Removes it from your dashboard

## API Endpoint

### Replace Document
**POST** `/api/documents/:documentId/replace`

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "upload_request_id": "string",
  "compliance_check_id": "string",
  "project_id": "string (required for GC lookup)",
  "subcontractor_id": "string",
  "broker_email": "string",
  "broker_name": "string",
  "reason": "string (required)"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Document replacement processed successfully",
  "document": {
    "id": "doc-123",
    "approval_status": "pending",
    "status": "pending_review",
    "replacement_reason": "Updated coverage amounts",
    "replaced_at": "2026-01-14T22:00:00Z",
    "replaced_by": "broker@example.com"
  },
  "notifications_sent": 2
}
```

## Database Changes

### InsuranceDocument Entity Updates
- `approval_status`: Changed to `'pending'`
- `status`: Changed to `'pending_review'`
- `replacement_reason`: Stores the reason provided by broker
- `replaced_at`: Timestamp of replacement
- `replaced_by`: Email/username of broker who replaced it
- `previous_approval_status`: Stores the previous status for audit

### BrokerUploadRequest Entity Updates
- `status`: Changed to `'under_review'`
- `replaced_at`: Timestamp of replacement

### ComplianceCheck Entity Updates
- `check_status`: Changed to `'pending'`
- `replaced_at`: Timestamp of replacement
- `replacement_reason`: Stores the reason

### New Notification Entity Records
Created for each GC on the project:
- `type`: `'document_replaced'`
- `recipient_email`: GC email address
- `subject`: "Document Re-Review Required: [Subcontractor Name]"
- `message`: Full description of the replacement
- `document_id`: ID of replaced document
- `project_id`: Associated project
- `subcontractor_id`: Associated subcontractor
- `broker_email`: Broker who made the replacement
- `broker_name`: Broker name
- `reason`: Replacement reason
- `status`: `'unread'`
- `read`: `false`

## Email Notifications

**Subject**: `⚠️ Document Re-Review Required - [Subcontractor] - [Project]`

**Content Includes**:
- Warning header with action required
- Subcontractor name
- Project name
- Document type
- Broker information
- Reason for replacement (if provided)
- Status change notification (COMPLIANT → PENDING REVIEW)
- Link to GC portal for review
- Contact information for broker and subcontractor

## UI Components

### ReplaceDocumentDialog
- Modal dialog for document replacement
- Shows warning about status change
- Required reason text field
- Cancel and Replace buttons
- Error handling and loading states

### NotificationBanner
- Displays at top of GC Dashboard
- Shows unread notifications
- Amber styling for document replacement alerts
- Dismiss button to mark as read
- Auto-refreshes every 30 seconds

### BrokerDashboard Updates
- "Replace" button added for active/approved documents
- Button appears next to "View" button
- Opens ReplaceDocumentDialog on click
- Refreshes page after successful replacement

### GCDashboard Updates
- NotificationBanner integrated at top
- Shows notifications for logged-in GC
- Responsive design for mobile/desktop

## Security

- **Authentication Required**: Only authenticated brokers can replace documents
- **Authorization**: Brokers can only replace documents they're assigned to
- **Audit Trail**: All replacements logged with timestamp and user
- **Input Validation**: Reason field required, prevents empty submissions
- **No Data Exposure**: Notifications don't expose sensitive policy data
- **Email Security**: Uses configured SMTP with TLS

## Development Notes

### Frontend Dependencies
- React Query for data fetching
- Shadcn UI components
- date-fns for date formatting
- Lucide React for icons

### Backend Dependencies
- Express.js for API
- Nodemailer for email sending
- JWT for authentication
- Express validator for input validation

### Configuration
- SMTP settings required in backend `.env` for email notifications
- If SMTP not configured, system logs mock emails to console
- Notification entity created automatically if it doesn't exist

## Troubleshooting

**Issue**: Emails not being sent
- **Solution**: Check backend `.env` for SMTP configuration
- In development: Emails are logged to console with mock mode

**Issue**: Notifications not appearing for GC
- **Solution**: Ensure GC email is correctly set in Contractor entity
- Check that project has correct `gc_id` field
- Verify Notification entity records were created

**Issue**: Replace button not showing
- **Solution**: Document must have status 'active' and COI must have `first_coi_url`
- Check that broker has proper authentication token

**Issue**: Status not changing after replacement
- **Solution**: Check backend logs for errors
- Verify all required IDs (project_id, compliance_check_id) are provided
- Ensure document exists in InsuranceDocument entity

## Future Enhancements

Potential improvements for future versions:
- Version history of replaced documents
- Side-by-side comparison of old vs new documents
- Automatic re-analysis of compliance for replaced documents
- Batch replacement for multiple documents
- Scheduled replacements for policy renewals
- Integration with document storage systems (S3, Azure Blob)
- Push notifications for mobile apps
- Slack/Teams integration for notifications
