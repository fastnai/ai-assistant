# AI Assistant with Tool Integration

This React application provides an AI assistant that can interact with various tools and execute them based on user requests. It uses the Gemini API for natural language processing and connects to various services like Gmail, Slack, Google Calendar, and more.

## Features

- **Streaming Responses**: The AI responds in real-time with a typing effect
- **Tool Integration**: Connects to various external APIs and services
- **Conversation History**: Maintains chat history between sessions
- **Run Tool Functionality**: Executes tools with specified parameters
- **Responsive UI**: Works on mobile and desktop
- **Sidebar with Available Tools**: Shows all tools the AI can use

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory and add your Gemini API key:
   ```
   REACT_APP_GEMINI_API_KEY=your_api_key_here
   ```
4. Start the development server:
   ```
   npm start
   ```

## How to Use

1. Send a message asking about available tools or requesting a specific action
2. The AI will analyze your request and may prepare an action
3. When an action is prepared, a "Run Tool" button will appear
4. Click the button to execute the action
5. The AI will process the result and provide a response

## Available Tools

The application dynamically loads available tools from the backend. These may include:
- Sending emails through Gmail
- Managing Google Calendar events
- Sending Slack messages
- Working with Google Sheets
- And more

## Application Structure

- `src/App.tsx`: Main component with chat interface
- `src/gemini.ts`: Integration with the Gemini API
- `src/api.ts`: API functions to fetch tools and execute them
- `src/components/`: UI components
- `src/types.ts`: TypeScript types and interfaces

## Environment Variables

- `REACT_APP_GEMINI_API_KEY`: Your Gemini API key for AI responses 
