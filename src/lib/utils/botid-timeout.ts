import { checkBotId } from 'botid/server';

/**
 * Wraps BotID verification with a timeout to prevent indefinite hanging.
 * If BotID verification takes longer than the specified timeout, it will reject.
 * 
 * @param timeoutMs - Timeout in milliseconds (default: 5000ms / 5 seconds)
 * @returns Promise that resolves with BotID verification result or rejects on timeout
 */
export async function checkBotIdWithTimeout(timeoutMs: number = 5000) {
  return Promise.race([
    checkBotId(),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('BotID verification timeout')), timeoutMs)
    )
  ]);
}
