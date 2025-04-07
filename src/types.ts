export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  isToolExecution?: boolean;
  hasAction?: boolean;
  actionData?: any;
}

export interface Conversation {
  messages: Message[];
}

export interface ToolParameter {
  type: string;
  title?: string;
  description?: string;
  required?: boolean;
  properties?: Record<string, any>;
}

export interface ToolFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    required?: string[];
    properties: Record<string, any>;
  };
}

export interface Tool {
  type: string;
  actionId: string;
  function: ToolFunction;
}

export interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}