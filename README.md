# FastNAI AI Assistant

A modern AI assistant application built with React, Vite, and TypeScript that integrates with various external services and tools using the FastNAI platform.

## Features

- **Interactive AI Chat**: Real-time streaming responses with a modern UI
- **Multiple AI Model Support**: Compatible with:
  - GPT-4o, GPT-4o-mini, GPT-4 Turbo, GPT-3.5 Turbo
  - Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0 Flash
  - O3-mini
- **Tool Integration**: Connect with external services via the FastNAI platform:
  - Google Workspace (Gmail, Calendar, Sheets)
  - Slack
  - HubSpot
  - And more
- **Responsive Design**: Works on desktop and mobile devices
- **User Authentication**: Secure login system with token management
- **Conversation History**: Persistent chat history between sessions

## Prerequisites

- Node.js (18.x or newer)
- npm or yarn
- FastNAI account credentials (for full functionality)

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/fastnai/ai-assistant.git
   cd ai-assistant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

   This will start the application at `http://localhost:5173/` (or another port if 5173 is in use)

4. **Build for production**
   ```bash
   npm run build
   ```

   The build files will be generated in the `dist` directory

## Authentication

The application requires authentication with FastNAI services:

1. **API Key**: Your FastNAI API key
2. **Space ID**: Your FastNAI workspace identifier
3. **Tenant ID**: Your organization's tenant ID

These credentials can be entered in the configuration sidebar of the application.

## Usage

1. **Login**: Use your FastNAI credentials to log in through the configuration panel
2. **Select Model**: Choose your preferred AI model from the dropdown
3. **Send Messages**: Type your questions or instructions in the chat input
4. **Execute Tools**: When the AI suggests a tool, you can authorize its execution
5. **View History**: Scroll through previous messages in the conversation

## Project Structure

- **`src/`**: Source code
  - **`components/`**: React components
  - **`types/`**: TypeScript type definitions
  - **`api.ts`**: API client for FastNAI services
  - **`llmCall.ts`**: AI communication logic
  - **`App.tsx`**: Main application component

## Development

- **Lint code**
  ```bash
  npm run lint
  ```

- **Preview production build**
  ```bash
  npm run preview
  ```

## License

Proprietary - Copyright © 2024 FastNAI
