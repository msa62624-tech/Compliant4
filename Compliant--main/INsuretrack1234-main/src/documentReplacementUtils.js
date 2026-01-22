import { getApiBase, getAuthHeader } from "@/api/apiClient";

/**
 * Replace an already-approved document and notify all relevant GCs
 * This changes the status from compliant/approved to pending review
 */
export async function replaceApprovedDocument({
  documentId,
  uploadRequestId,
  complianceCheckId,
  projectId,
  subcontractorId,
  brokerEmail,
  brokerName,
  reason
}) {
  try {
    // Call the backend API to process the replacement
    // Backend handles all the logic including notifications
    const url = `${getApiBase()}/api/documents/${documentId}/replace`;
    const fetchResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      credentials: 'include',
      body: JSON.stringify({
        upload_request_id: uploadRequestId,
        compliance_check_id: complianceCheckId,
        project_id: projectId,
        subcontractor_id: subcontractorId,
        broker_email: brokerEmail,
        broker_name: brokerName,
        reason: reason
      })
    });

    if (!fetchResponse.ok) {
      const error = await fetchResponse.text();
      throw new Error(`API Error (${fetchResponse.status}): ${error}`);
    }

    const response = await fetchResponse.json();
    return response;
  } catch (error) {
    console.error('❌ Error replacing document:', error);
    throw error;
  }
}

/**
 * Check if a document can be replaced by a broker
 */
export function canReplaceDocument(document) {
  if (!document) return false;
  
  // Can only replace approved documents
  return document.approval_status === 'approved' || 
         document.status === 'approved';
}
