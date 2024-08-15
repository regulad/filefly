#!/bin/bash

# Generate a 256-bit (32-byte) random key
key=$(openssl rand -base64 32)

# Output the key
echo "Your new encryption key is:"
echo "$key"

echo ""
echo "Important: Store this key securely and do not share it!"
