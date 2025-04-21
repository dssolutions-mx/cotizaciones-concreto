import { financialService } from './src/lib/supabase/financial';

async function createTestBalances() {
  try {
    console.log('Attempting to create test balances...');
    const result = await financialService.createTestBalanceRecords();
    console.log('Result:', result);
  } catch (error) {
    console.error('Error creating test balances:', error);
  }
}

createTestBalances(); 