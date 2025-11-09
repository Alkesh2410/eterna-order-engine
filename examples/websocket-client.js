/**
 * Example WebSocket client for order status updates
 * 
 * Usage:
 * 1. Submit an order via POST /api/orders/execute to get orderId
 * 2. Connect to WebSocket using the orderId
 * 3. Receive real-time status updates
 */

const WebSocket = require('ws');

// Replace with your server URL
const BASE_URL = process.env.BASE_URL || 'ws://localhost:3000';
const ORDER_ID = process.argv[2]; // Pass orderId as command line argument

if (!ORDER_ID) {
  console.error('Usage: node websocket-client.js <orderId>');
  process.exit(1);
}

const ws = new WebSocket(`${BASE_URL}/ws/orders/${ORDER_ID}/status`);

ws.on('open', () => {
  console.log(`✅ Connected to order ${ORDER_ID}`);
  console.log('Waiting for status updates...\n');
});

ws.on('message', (data) => {
  const update = JSON.parse(data.toString());
  
  console.log('📊 Status Update:');
  console.log(`   Order ID: ${update.orderId}`);
  console.log(`   Status: ${update.status}`);
  
  if (update.message) {
    console.log(`   Message: ${update.message}`);
  }
  
  if (update.dexProvider) {
    console.log(`   DEX Provider: ${update.dexProvider}`);
  }
  
  if (update.executionPrice) {
    console.log(`   Execution Price: ${update.executionPrice}`);
  }
  
  if (update.txHash) {
    console.log(`   Transaction Hash: ${update.txHash}`);
  }
  
  if (update.error) {
    console.log(`   ❌ Error: ${update.error}`);
  }
  
  console.log(''); // Empty line for readability
  
  // Close connection when order is confirmed or failed
  if (update.status === 'confirmed' || update.status === 'failed') {
    console.log('Order processing complete. Closing connection...');
    ws.close();
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('Connection closed');
  process.exit(0);
});

