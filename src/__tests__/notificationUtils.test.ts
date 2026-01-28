import { describe, it, expect, vi } from 'vitest';
import { 
  sanitizeFilename, 
  prepareAttachments,
  sendEmailWithErrorHandling 
} from '@/utils/notificationUtils';

describe('notificationUtils', () => {
  describe('sanitizeFilename', () => {
    it('should replace unsafe characters with underscores', () => {
      expect(sanitizeFilename('test<file>name')).toBe('test_file_name');
      expect(sanitizeFilename('file:with"quotes')).toBe('file_with_quotes');
      expect(sanitizeFilename('path/with\\slashes')).toBe('path_with_slashes');
    });

    it('should replace spaces with underscores', () => {
      expect(sanitizeFilename('Company Name Here')).toBe('Company_Name_Here');
    });

    it('should handle empty or invalid input', () => {
      expect(sanitizeFilename('')).toBe('Unknown');
      expect(sanitizeFilename(null)).toBe('Unknown');
      expect(sanitizeFilename(undefined)).toBe('Unknown');
      expect(sanitizeFilename(123)).toBe('Unknown');
    });

    it('should preserve safe characters', () => {
      expect(sanitizeFilename('ValidName123')).toBe('ValidName123');
      expect(sanitizeFilename('name_with-dash.pdf')).toBe('name_with-dash.pdf');
    });
  });

  describe('prepareAttachments', () => {
    it('should prepare COI attachment when pdf_url exists', () => {
      const coi = { pdf_url: 'https://example.com/coi.pdf' };
      const subcontractor = { company_name: 'Test Company' };
      const project = { project_name: 'Test Project' };

      const attachments = prepareAttachments(coi, subcontractor, project);

      expect(attachments).toHaveLength(1);
      expect(attachments[0]).toEqual({
        filename: 'COI_Test_Company_Test_Project.pdf',
        path: 'https://example.com/coi.pdf'
      });
    });

    it('should prepare both COI and Hold Harmless attachments', () => {
      const coi = {
        pdf_url: 'https://example.com/coi.pdf',
        hold_harmless_sub_signed_url: 'https://example.com/hold-harmless.pdf'
      };
      const subcontractor = { company_name: 'Test Company' };
      const project = { project_name: 'Test Project' };

      const attachments = prepareAttachments(coi, subcontractor, project);

      expect(attachments).toHaveLength(2);
      expect(attachments[0].filename).toBe('COI_Test_Company_Test_Project.pdf');
      expect(attachments[1].filename).toBe('HoldHarmless_Test_Company_Test_Project.pdf');
    });

    it('should handle missing URLs gracefully', () => {
      const coi = {};
      const subcontractor = { company_name: 'Test Company' };
      const project = { project_name: 'Test Project' };

      const attachments = prepareAttachments(coi, subcontractor, project);

      expect(attachments).toHaveLength(0);
    });

    it('should sanitize company and project names in filenames', () => {
      const coi = { pdf_url: 'https://example.com/coi.pdf' };
      const subcontractor = { company_name: 'Test <Company>' };
      const project = { project_name: 'Project: Name' };

      const attachments = prepareAttachments(coi, subcontractor, project);

      expect(attachments[0].filename).toBe('COI_Test__Company__Project__Name.pdf');
    });

    it('should use fallback URLs for COI', () => {
      const coi = { regenerated_coi_url: 'https://example.com/coi2.pdf' };
      const subcontractor = { company_name: 'Test Company' };
      const project = { project_name: 'Test Project' };

      const attachments = prepareAttachments(coi, subcontractor, project);

      expect(attachments).toHaveLength(1);
      expect(attachments[0].path).toBe('https://example.com/coi2.pdf');
    });
  });

  describe('sendEmailWithErrorHandling', () => {
    it('should call sendEmail function successfully', async () => {
      const mockSendEmail = vi.fn().mockResolvedValue(true);
      const emailParams = { to: 'test@example.com', subject: 'Test' };

      const result = await sendEmailWithErrorHandling(
        emailParams,
        'test notification',
        mockSendEmail
      );

      expect(result).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith(emailParams);
    });

    it('should handle errors and return false', async () => {
      const mockSendEmail = vi.fn().mockRejectedValue(new Error('Email failed'));
      const emailParams = { to: 'test@example.com', subject: 'Test' };
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await sendEmailWithErrorHandling(
        emailParams,
        'test notification',
        mockSendEmail
      );

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error sending test notification:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should log the correct context in error message', async () => {
      const mockSendEmail = vi.fn().mockRejectedValue(new Error('Network error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await sendEmailWithErrorHandling(
        {},
        'broker assignment notification',
        mockSendEmail
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error sending broker assignment notification:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
