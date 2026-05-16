#!/usr/bin/env node

const apiKey = process.env.SNOWTRACE_API_KEY;
const baseUrl = process.env.SNOWTRACE_BASE_URL || 'https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api';

console.log('🔍 Snowtrace Integration Check\n');
console.log(`API Key: ${apiKey ? `${apiKey.substring(0, 10)}...` : '❌ NOT SET'}`);
console.log(`Base URL: ${baseUrl}\n`);

if (!apiKey) {
  console.error('❌ Error: SNOWTRACE_API_KEY not configured in .env');
  process.exit(1);
}

async function checkBalance() {
  console.log('📡 Test 1: Fetching account balance...');
  
  const url = new URL(baseUrl);
  url.searchParams.set('module', 'account');
  url.searchParams.set('action', 'balance');
  url.searchParams.set('address', '0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae');
  url.searchParams.set('tag', 'latest');
  url.searchParams.set('apikey', apiKey);

  try {
    const response = await fetch(url.toString());
    console.log(`   HTTP Status: ${response.status}`);

    if (!response.ok) {
      console.error(`   ❌ HTTP Error: ${response.status}`);
      return false;
    }

    const body = await response.json();
    console.log(`   Response status: ${body.status}`);
    
    if (body.status === '0') {
      console.error(`   ❌ API Error: ${body.message}`);
      return false;
    }

    console.log(`   ✅ Balance: ${body.result} wei\n`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
    return false;
  }
}

async function checkTransactionReceipt() {
  console.log('📡 Test 2: Fetching transaction receipt...');
  
  const sampleTxHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  const url = new URL(baseUrl);
  url.searchParams.set('module', 'proxy');
  url.searchParams.set('action', 'eth_getTransactionReceipt');
  url.searchParams.set('txhash', sampleTxHash);
  url.searchParams.set('apikey', apiKey);

  try {
    const response = await fetch(url.toString());
    console.log(`   HTTP Status: ${response.status}`);

    if (!response.ok) {
      console.error(`   ❌ HTTP Error: ${response.status}`);
      return false;
    }

    const body = await response.json();
    console.log(`   Response: ${JSON.stringify(body)}`);
    
    // For non-existent tx, we expect null result, which is fine
    console.log(`   ✅ API is responding correctly (result is ${body.result === null ? 'null (expected for non-existent tx)' : 'available'})\n`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
    return false;
  }
}

async function main() {
  const test1 = await checkBalance();
  const test2 = await checkTransactionReceipt();

  if (test1 && test2) {
    console.log('✅ All Snowtrace checks passed!');
    console.log('\nYou can now use the Snowtrace adapter in the backend.');
    process.exit(0);
  } else {
    console.log('❌ Some Snowtrace checks failed.');
    process.exit(1);
  }
}

main();
