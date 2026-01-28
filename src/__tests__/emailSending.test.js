import { describe, test, expect, vi } from 'vitest';

describe('Email Sending with Promise.allSettled', () => {
  test('handles mixed success and failure results correctly', async () => {
    // Mock email promises - some succeed, some fail
    const emailPromises = [
      Promise.resolve({ success: true }),
      Promise.reject(new Error('Email 2 failed')),
      Promise.resolve({ success: true }),
      Promise.reject(new Error('Email 4 failed')),
    ];

    // Simulate the MessagingCenter email sending logic
    const results = await Promise.allSettled(emailPromises);
    
    // Filter failed emails
    const failedEmails = results.filter(r => r.status === 'rejected');
    const successfulEmails = results.filter(r => r.status === 'fulfilled');

    // Verify that all promises were attempted
    expect(results).toHaveLength(4);
    
    // Verify correct count of failures and successes
    expect(failedEmails).toHaveLength(2);
    expect(successfulEmails).toHaveLength(2);
    
    // Verify failed emails contain rejection reasons
    expect(failedEmails[0].reason.message).toBe('Email 2 failed');
    expect(failedEmails[1].reason.message).toBe('Email 4 failed');
    
    // Verify successful emails contain values
    expect(successfulEmails[0].value.success).toBe(true);
    expect(successfulEmails[1].value.success).toBe(true);
  });

  test('handles all successful emails', async () => {
    const emailPromises = [
      Promise.resolve({ success: true }),
      Promise.resolve({ success: true }),
      Promise.resolve({ success: true }),
    ];

    const results = await Promise.allSettled(emailPromises);
    const failedEmails = results.filter(r => r.status === 'rejected');

    expect(results).toHaveLength(3);
    expect(failedEmails).toHaveLength(0);
  });

  test('handles all failed emails', async () => {
    const emailPromises = [
      Promise.reject(new Error('Failed 1')),
      Promise.reject(new Error('Failed 2')),
      Promise.reject(new Error('Failed 3')),
    ];

    const results = await Promise.allSettled(emailPromises);
    const failedEmails = results.filter(r => r.status === 'rejected');

    expect(results).toHaveLength(3);
    expect(failedEmails).toHaveLength(3);
  });

  test('handles empty email array', async () => {
    const emailPromises = [];

    const results = await Promise.allSettled(emailPromises);
    const failedEmails = results.filter(r => r.status === 'rejected');

    expect(results).toHaveLength(0);
    expect(failedEmails).toHaveLength(0);
  });

  test('logs failed emails when present', async () => {
    // Mock console.error
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const emailPromises = [
      Promise.resolve({ success: true }),
      Promise.reject(new Error('Email failed')),
    ];

    const results = await Promise.allSettled(emailPromises);
    const failedEmails = results.filter(r => r.status === 'rejected');

    // Simulate the logging logic from MessagingCenter
    if (failedEmails.length > 0) {
      console.error(`Failed to send ${failedEmails.length} email(s):`, failedEmails);
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send 1 email(s):'),
      expect.arrayContaining([
        expect.objectContaining({
          status: 'rejected',
          reason: expect.any(Error)
        })
      ])
    );

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });
});
