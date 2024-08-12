#!/bin/bash

# Find all .env.example files and copy them to .env.local
find . -name ".env.example" -type f | while read -r file; do
    dir=$(dirname "$file")
    cp "$file" "$dir/.env.local"
    echo "Copied $file to $dir/.env.local"
done

echo "Finished copying .env.example files to .env.local"
