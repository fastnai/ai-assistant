import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Message, Conversation, Tool } from './types';
import { getTools, executeTool } from './api';
import { getStreamingAIResponse, getToolExecutionResponse } from './gemini';
import { PlayCircle, RefreshCw, ChevronRight, ChevronLeft, Wrench, Trash2 } from 'lucide-react';

function App() {
  const [conversation, setConversation] = useState<Conversation>(() => {
    const saved = localStorage.getItem('conversation');
    return saved ? JSON.parse(saved) : { messages: [] };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentJson, setCurrentJson] = useState<any>(null);
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [streamingText, setStreamingText] = useState('');
  const [toolResults, setToolResults] = useState<Record<string, any>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  // Save conversation to localStorage
  useEffect(() => {
    localStorage.setItem('conversation', JSON.stringify(conversation));
  }, [conversation]);

  const loadTools = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      const tools = await getTools('chat');
      setAvailableTools(tools);
    } catch (error) {
      console.error('Error loading tools:', error);
      setError('Failed to load tools. Please try refreshing.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadTools();
  }, []);

  // Helper function to create a modified conversation history that includes tool execution results
  const prepareContextForLLM = (messages: Message[]) => {
    return messages.map(msg => {
      // If this message has a tool result, include it in the content
      if (msg.id in toolResults) {
        const toolResult = toolResults[msg.id];
        const toolName = msg.actionData?.name || 'tool';
        return {
          ...msg,
          content: `${msg.content}\n\n[Tool Execution: ${toolName}]\nParameters: ${JSON.stringify(msg.actionData?.parameters)}\nResult: ${JSON.stringify(toolResult)}`
        };
      }
      return msg;
    });
  };

  const addMessage = (role: 'user' | 'assistant', content: string, options: any = {}) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: Date.now(),
      ...options
    };
    setConversation((prev: Conversation) => ({
      messages: [...prev.messages, newMessage],
    }));
    return newMessage.id;
  };

  const handleSendMessage = async (message: string) => {
    setIsLoading(true);
    setError(null);
    addMessage('user', message);
    setStreamingText('');
    
    try {
      if (!availableTools.length) {
        throw new Error('Tools not loaded yet. Please wait or refresh.');
      }

      // Create a temporary streaming message
      const tempId = `temp-${Date.now()}`;
      setConversation(prev => ({
        messages: [
          ...prev.messages,
          {
            id: tempId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
          },
        ],
      }));

      // Prepare conversation history with tool results included
      const contextWithToolResults = prepareContextForLLM(conversation.messages);

      // Start streaming
      getStreamingAIResponse(
        message,
        availableTools,
        contextWithToolResults,
        (text) => {
          // Update the streaming text
          setStreamingText(text);
          
          // Update the temporary message
          setConversation(prev => ({
            messages: prev.messages.map(msg => 
              msg.id === tempId ? { ...msg, content: text } : msg
            ),
          }));
        },
        (response) => {
          // When streaming is complete, finalize the message
          setConversation(prev => ({
            messages: prev.messages.map(msg =>
              msg.id === tempId ? { 
                ...msg, 
                content: response.response,
                isStreaming: false,
                hasAction: !!response.action, // Add flag to indicate this message has an action
                actionData: response.action // Store action data directly with the message
              } : msg
            ),
          }));
          
          // If there's an action, set it
          if (response.action) {
            console.log('Action detected:', response.action);
            setCurrentJson(response.action);
          } else {
            // Clear any previous action
            setCurrentJson(null);
          }
          
          setIsLoading(false);
          setStreamingText('');
        }
      ).catch(error => {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        setError(errorMessage);
        
        // Update the temporary message to show the error
        setConversation(prev => ({
          messages: prev.messages.map(msg =>
            msg.id === tempId ? { 
              ...msg, 
              content: `Error: ${errorMessage}`,
              isStreaming: false 
            } : msg
          ),
        }));
        
        setIsLoading(false);
        setStreamingText('');
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setError(errorMessage);
      addMessage('assistant', `Error: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  const handleExecuteTool = async (actionData: any) => {
    if (!actionData || !actionData.actionId) {
      setError("Invalid tool action data");
      return;
    }
    
    // Identify which tool we're executing
    const toolName = actionData.name?.replace('mcp_fastn_', '') || 
                    (actionData.actionId && actionData.actionId.split('_').pop()) || 
                    'tool';
    
    console.log('Executing tool:', toolName, actionData);
    
    // Store which message triggered this action
    const sourceMessageId = conversation.messages.find(
      msg => msg.actionData && 
      msg.actionData.actionId === actionData.actionId
    )?.id;
    
    // If we couldn't find the source message, use the last assistant message
    const messageId = sourceMessageId || `temp-${Date.now()}`;
    
    setIsLoading(true);
    setError(null);
    try {
      // Add a notification that we're executing the tool
      addMessage('assistant', `Executing ${toolName}...`, { isToolExecution: true });
      
      // Execute the tool with the provided actionId and parameters
      const response = await executeTool(
        actionData.actionId, 
        actionData.parameters
      );
      
      // Store the raw response for debugging
      console.log('Tool execution response:', response);
      
      // Store the result to show in the UI
      setToolResults(prev => ({
        ...prev,
        [messageId]: response
      }));
      
      // Prepare conversation history with tool results included
      const contextWithToolResults = prepareContextForLLM([
        ...conversation.messages,
        // Add a virtual system message with tool execution info for context
        {
          id: `system-${Date.now()}`,
          role: 'assistant',
          content: `Tool "${toolName}" was executed with parameters: ${JSON.stringify(actionData.parameters)} and returned: ${JSON.stringify(response)}`,
          timestamp: Date.now()
        }
      ]);
      
      // Create a temporary streaming message
      const tempId = `temp-${Date.now()}`;
      setConversation(prev => ({
        messages: [
          ...prev.messages,
          {
            id: tempId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
          },
        ],
      }));
      
      // Get AI response for the tool execution result with streaming
      getToolExecutionResponse(
        actionData.name || toolName,
        response,
        contextWithToolResults,
        availableTools,
        (text) => {
          // Update the streaming text
          setStreamingText(text);
          
          // Update the temporary message
          setConversation(prev => ({
            messages: prev.messages.map(msg => 
              msg.id === tempId ? { ...msg, content: text } : msg
            ),
          }));
        },
        (aiResponse) => {
          // When streaming is complete, finalize the message
          setConversation(prev => ({
            messages: prev.messages.map(msg =>
              msg.id === tempId ? { 
                ...msg, 
                content: aiResponse.response,
                isStreaming: false,
                hasAction: !!aiResponse.action,
                actionData: aiResponse.action
              } : msg
            ),
          }));
          
          // Clear current action
          setCurrentJson(null);
          
          setIsLoading(false);
          setStreamingText('');
        }
      ).catch(error => {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        setError(errorMessage);
        
        // Update the temporary message to show the error
        setConversation(prev => ({
          messages: prev.messages.map(msg =>
            msg.id === tempId ? { 
              ...msg, 
              content: `Error: ${errorMessage}`,
              isStreaming: false 
            } : msg
          ),
        }));
        
        setIsLoading(false);
        setStreamingText('');
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setError(errorMessage);
      addMessage('assistant', `Error executing tool: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    setConversation({ messages: [] });
    setCurrentJson(null);
    setToolResults({});
    setError(null);
    localStorage.removeItem('conversation');
  };

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex flex-col">
      <div className="container mx-auto max-w-4xl p-4">
        <div className="flex flex-col items-center mb-4">
          <img 
            src="https://www.shutterstock.com/image-vector/chat-bot-icon-virtual-smart-600nw-2478937553.jpg"
            alt="AI Agent" 
            className="w-20 h-20 rounded-full mb-3 shadow-md" 
          />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">AI Assistant</h1>
          <button
            onClick={clearConversation}
            className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors mt-2"
          >
            <Trash2 className="w-5 h-5" />
            Clear Chat
          </button>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}
      </div>
      
      <div className="flex-1 flex">
        <div className={`flex-1 container mx-auto ${sidebarVisible ? 'max-w-3xl' : 'max-w-4xl'} p-4 flex flex-col gap-4`}>
          <div className="bg-white rounded-lg shadow-md p-4 flex-1 overflow-y-auto space-y-4 max-h-[calc(100vh-300px)]">
            {conversation.messages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <p>Send a message to start the conversation</p>
              </div>
            ) : (
              conversation.messages.map((message) => (
                <ChatMessage 
                  key={message.id} 
                  message={message}
                  onExecuteTool={handleExecuteTool}
                  isLoading={isLoading}
                  toolResults={message.id in toolResults ? toolResults[message.id] : undefined}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="sticky bottom-0 bg-white rounded-lg shadow-md p-4">
            <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
            {isLoading && !streamingText && (
              <div className="text-center mt-2 text-sm text-gray-500">
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-500 border-r-transparent align-[-0.125em] mr-2"></div>
                Processing your request...
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Toggle Button */}
        <button 
          onClick={toggleSidebar} 
          className="fixed right-0 top-1/2 transform -translate-y-1/2 bg-blue-500 text-white p-2 rounded-l-lg shadow-md hover:bg-blue-600 z-10"
          title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarVisible ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>

        {/* Tools Sidebar */}
        {sidebarVisible && (
          <div className="w-80 bg-white shadow-md p-4 h-[80vh] overflow-y-auto fixed right-0 top-1/2 transform -translate-y-1/2 rounded-l-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Available Tools</h2>
              <button
                onClick={loadTools}
                disabled={isRefreshing}
                className="p-2 rounded-full hover:bg-gray-100"
                title="Refresh Tools"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            {availableTools.length > 0 ? (
              <div className="space-y-4 overflow-y-auto">
                {availableTools.map((tool: Tool, index: number) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="w-5 h-5 text-blue-500" />
                      <h3 className="font-semibold text-blue-700">{tool.function.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">{
                      tool.function.description
                        .split('. ')[0]
                        .replace("This tool is designed to execute the ", "")
                        .replace(" operation on the ", " - ")
                        .replace(" platform", "")
                    }</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40">
                <p className="text-gray-500">
                  {isRefreshing ? 'Loading tools...' : 'No tools available'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;