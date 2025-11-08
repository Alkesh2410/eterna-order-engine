#!/bin/bash

# Example script to submit an order and connect to WebSocket

BASE_URL=${BASE_URL:-"http://localhost:3000"}

echo "Submitting order..."

# Submit order
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/orders/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "market",
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": "100",
    "slippageTolerance": 1.0
  }')

echo "Response: $RESPONSE"

# Extract orderId (requires jq: brew install jq)
ORDER_ID=$(echo $RESPONSE | jq -r '.orderId')

if [ -z "$ORDER_ID" ] || [ "$ORDER_ID" = "null" ]; then
  echo "Failed to get orderId"
  exit 1
fi

echo "Order ID: $ORDER_ID"
echo ""
echo "Connect to WebSocket with:"
echo "  node examples/websocket-client.js $ORDER_ID"
echo ""
echo "Or use wscat:"
echo "  wscat -c ws://localhost:3000/api/orders/$ORDER_ID/status"

