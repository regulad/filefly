#!/bin/sh

# ~/.config/husky/init.sh

# Check if Homebrew directory exists
if [ -d "/home/linuxbrew/.linuxbrew/bin" ]; then
  # Add Homebrew to PATH
  export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"
fi

if command -v nodenv >/dev/null 2>&1; then
  eval "$(nodenv init -)"
fi

# Add pyenv shims to PATH
if [ -d "$HOME/.pyenv/shims" ]; then
  export PATH="$HOME/.pyenv/shims:$PATH"
fi
