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

  test('correctly maps recipients to failed emails using reduce', async () => {
    // Mock recipients
    const selectedRecipients = [
      { email: 'user1@test.com', name: 'User 1' },
      { email: 'user2@test.com', name: 'User 2' },
      { email: 'user3@test.com', name: 'User 3' },
      { email: 'user4@test.com', name: 'User 4' },
    ];

    // Mock email promises - emails at index 1 and 3 fail
    const emailPromises = [
      Promise.resolve({ success: true }),
      Promise.reject(new Error('Failed to send to user2')),
      Promise.resolve({ success: true }),
      Promise.reject(new Error('Failed to send to user4')),
    ];

    const results = await Promise.allSettled(emailPromises);

    // Use the corrected reduce-based mapping logic
    const failureDetails = results.reduce((acc, result, index) => {
      if (result.status === 'rejected') {
        acc.push({
          recipient: selectedRecipients[index]?.email || 'unknown',
          error: result.reason?.message || 'Unknown error'
        });
      }
      return acc;
    }, []);

    // Verify that the failure details correctly map to the right recipients
    expect(failureDetails).toHaveLength(2);
    expect(failureDetails[0].recipient).toBe('user2@test.com');
    expect(failureDetails[0].error).toBe('Failed to send to user2');
    expect(failureDetails[1].recipient).toBe('user4@test.com');
    expect(failureDetails[1].error).toBe('Failed to send to user4');
  });

  test('recipient mapping handles missing recipients gracefully', async () => {
    // Mock recipients - intentionally shorter than promises array
    const selectedRecipients = [
      { email: 'user1@test.com' },
      { email: 'user2@test.com' },
    ];

    // Mock email promises - more promises than recipients
    const emailPromises = [
      Promise.resolve({ success: true }),
      Promise.reject(new Error('Failed 1')),
      Promise.reject(new Error('Failed 2')),
      Promise.reject(new Error('Failed 3')),
    ];

    const results = await Promise.allSettled(emailPromises);

    // Use the corrected reduce-based mapping logic
    const failureDetails = results.reduce((acc, result, index) => {
      if (result.status === 'rejected') {
        acc.push({
          recipient: selectedRecipients[index]?.email || 'unknown',
          error: result.reason?.message || 'Unknown error'
        });
      }
      return acc;
    }, []);

    // Verify that missing recipients default to 'unknown'
    expect(failureDetails).toHaveLength(3);
    expect(failureDetails[0].recipient).toBe('user2@test.com'); // index 1
    expect(failureDetails[1].recipient).toBe('unknown'); // index 2 - no recipient
    expect(failureDetails[2].recipient).toBe('unknown'); // index 3 - no recipient
  });
});
