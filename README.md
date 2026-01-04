# Claude Agent SDK

A demonstration project showcasing how to build AI-powered applications using Claude AI as an autonomous agent. This project provides a TypeScript/Node.js SDK integration with multiple example implementations.

## Features

- **CLI Agent**: Run Claude as a one-off agent to perform tasks like code review and bug fixes
- **Web Server**: Interactive chat interface with real-time streaming
- **GitHub Actions**: Automated code reviews and interactive Claude assistance on PRs/issues
- **Tool Calling**: File operations, code searches, and command execution

## Prerequisites

- Node.js (v18 or higher recommended)
- npm
- An Anthropic API key (set as `ANTHROPIC_API_KEY` environment variable)

## Installation

```bash
npm install
```

## Usage

### CLI Agent

Run Claude as an agent with a single prompt:

```bash
tsx agent.ts "Your prompt here"
```

Example:

```bash
tsx agent.ts "Review utils.py for bugs that would cause crashes. Fix any issues you find."
```

### Web Server

Start the interactive chat interface:

```bash
tsx server.ts
```

Then open `http://localhost:3000` in your browser.

#### Port Configuration

Configure the port using CLI flags or environment variables:

```bash
# CLI flags
tsx server.ts --port 8080
tsx server.ts -p 3001

# Environment variable
PORT=5000 tsx server.ts
```

Priority order: CLI flags > `PORT` environment variable > default (3000)

### Streaming Reference

View the reference implementation for web streaming:

```bash
tsx stream-to-web.ts "Your prompt here"
```

## Project Structure

```
claude-agent-sdk/
├── agent.ts              # CLI agent example
├── server.ts             # Web server with chat interface
├── stream-to-web.ts      # Streaming output reference
├── utils.py              # Sample test file for agent tasks
├── package.json          # Dependencies and scripts
└── .github/workflows/    # GitHub Actions for CI/CD
    ├── claude.yml        # Interactive Claude on issues/PRs
    └── claude-code-review.yml  # Automatic PR code reviews
```

## Available Agent Tools

The Claude agent can use the following tools:

| Tool | Description |
|------|-------------|
| `Read` | Read file contents |
| `Write` | Create new files |
| `Edit` | Modify existing files |
| `Glob` | Find files by pattern |
| `Grep` | Search file contents |
| `Bash` | Execute shell commands |

## Web Interface Features

- Real-time streaming of Claude's responses
- Display of thinking, tool calls, and results
- Session persistence for multi-turn conversations
- Auto-resizing input textarea
- Dark theme UI

## GitHub Actions

### Interactive Claude (`claude.yml`)

Responds to comments mentioning `@claude` in issues and pull requests.

### Automatic Code Review (`claude-code-review.yml`)

Triggers on PR creation and updates to provide structured code review feedback.

## Dependencies

- `@anthropic-ai/claude-agent-sdk` - Anthropic's official agent SDK
- `express` - Web framework for the HTTP server
- `typescript` - TypeScript compiler
- `tsx` - TypeScript executor

## License

MIT
