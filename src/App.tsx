import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Message, Conversation, Tool } from './types';
import { getTools, executeTool } from './api';
import { getStreamingAIResponse, getToolExecutionResponse } from './llmCall';
import { PlayCircle, RefreshCw, ChevronRight, ChevronLeft, Wrench, Trash2, KeyRound, Fingerprint, LayoutGrid, ChevronDown, ChevronUp } from 'lucide-react';
import FastnWidget from '@fastn-ai/widget-react';

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

  // State for API Key and Space ID, loaded from localStorage
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('fastnApiKey') || '');
  const [spaceId, setSpaceId] = useState<string>(() => localStorage.getItem('fastnSpaceId') || '');
  // State for model selection, loaded from localStorage
  const [tenantId, setTenantId] = useState<string>(() => localStorage.getItem('fastnTenantId') || '');
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('fastnSelectedModel') || 'claude-3-7-sonnet-20250219');

  const [sidebarView, setSidebarView] = useState<'tools' | 'widgets'>('tools');
  const [configExpanded, setConfigExpanded] = useState(true);

  // Available models that support tool calls
  const modelsWithToolCalls = [
    // { name: 'Claude 3.7 Sonnet', id: 'claude-3-7-sonnet-20250219' },
    // { name: 'Claude 3.5 Sonnet', id: 'claude-3-5-sonnet-20241022' },
    // { name: 'Claude 3.5 Haiku', id: 'claude-3-5-haiku-20241022' },
    { name: 'GPT-4o', id: 'gpt-4o' },
    { name: 'GPT-4o-mini', id: 'gpt-4o-mini' },
    { name : "O3-mini", id: "o3-mini"},
    { name: 'GPT-4 Turbo', id: 'gpt-4' },
    { name: 'GPT-3.5 Turbo', id: 'gpt-3.5-turbo' },
    { name: 'Gemini 1.5 Pro 001', id: 'gemini-1.5-pro-001' },
    { name: 'Gemini 1.5 Pro 002', id: 'gemini-1.5-pro-002' },
    { name: 'Gemini 1.5 Flash 002', id: 'gemini-1.5-flash-002' },
    { name: 'Gemini 2.0 Flash 001', id: 'gemini-2.0-flash-001' }
  ];

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  // Save conversation to localStorage
  useEffect(() => {
    localStorage.setItem('conversation', JSON.stringify(conversation));
  }, [conversation]);

  // Save credentials to localStorage
  useEffect(() => {
    localStorage.setItem('fastnApiKey', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('fastnSpaceId', spaceId);
  }, [spaceId]);

  useEffect(() => {
    localStorage.setItem('fastnTenantId', tenantId);
  }, [tenantId]);

  useEffect(() => {
    localStorage.setItem('fastnSelectedModel', selectedModel);
  }, [selectedModel]);

  const loadTools = async () => {
    if (!apiKey || !spaceId) {
      setError('API Key and Space ID are required to load tools.');
      setAvailableTools([]); // Clear tools if credentials missing
      return;
    }
    try {
      setIsRefreshing(true);
      setError(null);
      // Pass apiKey and spaceId to getTools
      const tools = await getTools('chat', apiKey, spaceId);
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
    if (!apiKey || !spaceId) {
      setError('API Key and Space ID are required before sending messages.');
      setIsLoading(false);
      return;
    }
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
        },
        selectedModel
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
    if (!apiKey || !spaceId) {
        setError('API Key and Space ID are required to execute tools.');
        setIsLoading(false);
        return;
    }
    
    if (!actionData) {
      setError("Invalid tool action data - no action data provided");
      return;
    }
    
    // Extract tool name from function name (removing prefixes)
    const toolName = actionData.name?.replace('mcp_fastn_', '') || 
                    (actionData.actionId && actionData.actionId.split('_').pop()) || 
                    'tool';

    console.log('Executing tool:', toolName, actionData);

    // Find the message that contains this actionData to link the result later
    const sourceMessage = conversation.messages.find(
        msg => msg.actionData && msg.actionData === actionData // Compare objects directly if possible
    );
    const messageId = sourceMessage?.id || `exec-${Date.now()}`; // Use message ID or a temporary one

    setIsLoading(true);
    setError(null);
    try {
      // Update the existing message to show we're executing the tool
      // Instead of adding a new message, we'll just update the existing one
      if (sourceMessage) {
        setConversation(prev => ({
          messages: prev.messages.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: `Executing ${toolName}...`, isToolExecution: true, executionId: messageId }
              : msg
          )
        }));
      } else {
        // If no source message found, add a new one
        addMessage('assistant', `Executing ${toolName}...`, { isToolExecution: true, executionId: messageId });
      }

      // For the new endpoint format, we need to pass just the parameters directly
      // The API function will find the right tool and endpoint based on actionId
      const response = await executeTool(
        actionData.actionId, 
        actionData.parameters || {}, // Ensure parameters is at least an empty object
        apiKey,             
        spaceId,            
        availableTools,
        tenantId // Pass tenant ID to executeTool      
      );

      console.log('Tool execution response:', response);

      // Store the result linked to the executionId
      setToolResults(prev => ({
        ...prev,
        [messageId]: response
      }));

      // Find the 'Executing...' message and update it
      setConversation(prev => {
        const messages = prev.messages.map(msg => 
          msg.executionId === messageId || msg.id === messageId
            ? { ...msg, content: `${toolName} executed.`, isToolExecution: false, toolResult: response } 
            : msg
        );
        return { ...prev, messages };
      });

      // Prepare context for the next AI call, including the execution result
      const contextWithExecutionResult = prepareContextForLLM([
        ...conversation.messages, 
        // Add a representation of the tool execution for the LLM context
        {
            id: `system-${messageId}`,
            role: 'assistant', 
            content: `[Tool Execution Result for ${toolName}]
Parameters: ${JSON.stringify(actionData.parameters || {})}
Result: ${JSON.stringify(response)}`,
            timestamp: Date.now(),
        }
      ]);

      // Instead of creating a new message, we'll continue updating the existing one
      getToolExecutionResponse(
        actionData.name || toolName,
        response,
        contextWithExecutionResult,
        availableTools,
        (text) => {
          // Update the streaming text
          setStreamingText(text);
          
          // Update the existing message
          setConversation(prev => ({
            messages: prev.messages.map(msg => 
              (msg.executionId === messageId || msg.id === messageId)
                ? { ...msg, content: text, isStreaming: true }
                : msg
            ),
          }));
        },
        (aiResponse) => {
          // When streaming is complete, finalize the message
          setConversation(prev => ({
            messages: prev.messages.map(msg =>
              (msg.executionId === messageId || msg.id === messageId)
                ? { 
                    ...msg, 
                    content: aiResponse.response,
                    isStreaming: false,
                    hasAction: !!aiResponse.action,
                    actionData: aiResponse.action
                  }
                : msg
            ),
          }));
          
          // If the AI suggests another action based on the tool result
          if (aiResponse.action) {
            console.log('Follow-up action detected:', aiResponse.action);
            setCurrentJson(aiResponse.action);
          } else {
            // Clear any previous action
            setCurrentJson(null);
          }
          
          setIsLoading(false);
          setStreamingText('');
        },
        selectedModel
      ).catch(error => {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        setError(errorMessage);
        
        // Update the existing message to show the error
        setConversation(prev => ({
          messages: prev.messages.map(msg =>
            (msg.executionId === messageId || msg.id === messageId)
              ? { 
                  ...msg, 
                  content: `Error: ${errorMessage}`,
                  isStreaming: false 
                }
              : msg
          ),
        }));
        
        setIsLoading(false);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setError(errorMessage);
      
      // Update the existing message with the error
      setConversation(prev => ({
        messages: prev.messages.map(msg =>
          (msg.executionId === messageId || msg.id === messageId)
            ? { 
                ...msg, 
                content: `Error executing tool: ${errorMessage}`,
                isStreaming: false 
              }
            : msg
        ),
      }));
      
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
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      {/* Main content area */}
      <div className="flex h-screen overflow-hidden">
        {/* Chat area */}
        <div className={`flex-1 flex flex-col ${sidebarVisible ? 'mr-[500px]' : ''} transition-all duration-300`}>
          {/* Header */}
          <div className="flex flex-col items-center pt-6 pb-4">
            <img 
              src="https://www.shutterstock.com/image-vector/chat-bot-icon-virtual-smart-600nw-2478937553.jpg"
              alt="AI Agent" 
              className="w-16 h-16 rounded-full mb-3 shadow-md" 
            />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">AI Assistant</h1>
            <button
              onClick={clearConversation}
              className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear Chat
            </button>
          </div>
          
          {/* Error message */}
          {error && (
            <div className="mx-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}
          
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="bg-white rounded-lg shadow-md p-4 h-full overflow-y-auto space-y-4">
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
          </div>
          
          {/* Chat input */}
          <div className="p-4">
            <div className="bg-white rounded-lg shadow-md p-4">
              <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
              {isLoading && !streamingText && (
                <div className="text-center mt-2 text-sm text-gray-500">
                  <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-500 border-r-transparent align-[-0.125em] mr-2"></div>
                  Processing your request...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Toggle Button */}
        <button 
          onClick={toggleSidebar} 
          className="fixed right-[500px] top-1/2 transform -translate-y-1/2 bg-blue-500 text-white p-2 rounded-l-lg shadow-md hover:bg-blue-600 z-10"
          style={{ right: sidebarVisible ? '500px' : '0' }}
          title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarVisible ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>

        {/* Tools Sidebar */}
        <div 
          className={`fixed top-0 right-0 my-5 w-[500px] bg-white shadow-md h-screen transition-transform duration-300 rounded-l-lg ${
            sidebarVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="h-full overflow-y-auto p-4 flex flex-col">
            {/* Configuration Section */}
            <div className="mb-4 border-b pb-2">
              <div className="flex justify-between items-center cursor-pointer mb-2" onClick={() => setConfigExpanded(!configExpanded)}>
                <h2 className="text-xl font-bold">Configuration</h2>
                {configExpanded ? 
                  <ChevronUp className="w-5 h-5 text-gray-500" /> : 
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                }
              </div>
              
              {configExpanded && (
                <div className="space-y-3 mb-2">
                  <div>
                    <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <KeyRound className="w-4 h-4 mr-1 text-gray-500" /> API Key
                    </label>
                    <input
                      type="password"
                      id="apiKey"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API Key"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="spaceId" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Fingerprint className="w-4 h-4 mr-1 text-gray-500" /> Space ID
                    </label>
                    <input
                      type="text"
                      id="spaceId"
                      value={spaceId}
                      onChange={(e) => setSpaceId(e.target.value)}
                      placeholder="Enter your Space ID"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="tenantId" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <KeyRound className="w-4 h-4 mr-1 text-gray-500" /> Tenant ID
                    </label>
                    <input
                      type="text"
                      id="tenantId"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      placeholder="Enter your Tenant ID"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="selectedModel" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <KeyRound className="w-4 h-4 mr-1 text-gray-500" /> Selected Model
                    </label>
                    <select
                      id="selectedModel"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      {modelsWithToolCalls.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Add a visual cue if credentials are missing */}
                  {(!apiKey || !spaceId) && (
                    <p className="text-xs text-red-600 mt-2">Credentials are required to load and use tools.</p>
                  )}
                </div>
              )}
            </div>

            {/* Toggle between Tools and Widgets */}
            <div className="flex mb-4 border-b pb-4">
              <button
                onClick={() => setSidebarView('widgets')}
                className={`flex-1 py-2 px-4 rounded-l-lg flex items-center justify-center gap-2 ${
                  sidebarView === 'widgets' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Connector Widgets
              </button>
              <button
                onClick={() => setSidebarView('tools')}
                className={`flex-1 py-2 px-4 rounded-r-lg flex items-center justify-center gap-2 ${
                  sidebarView === 'tools' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Wrench className="w-4 h-4" />
                Tools
              </button>
            </div>

            {/* Content based on selected view */}
            <div className={`flex-1 overflow-y-auto ${configExpanded ? 'max-h-[calc(100vh-280px)]' : 'max-h-[calc(100vh-130px)]'}`}>
              {sidebarView === 'tools' ? (
                <>
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-bold">Available Tools</h2>
                    <button
                      onClick={loadTools}
                      disabled={isRefreshing || !apiKey || !spaceId}
                      className={`p-2 rounded-full hover:bg-gray-100 ${(!apiKey || !spaceId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={!apiKey || !spaceId ? "Enter Credentials to Load Tools" : "Refresh Tools"}
                    >
                      <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  
                  {(!apiKey || !spaceId) ? (
                    <div className="flex items-center justify-center h-20">
                      <p className="text-gray-500 text-center text-sm px-4">Enter API Key and Space ID above to load tools.</p>
                    </div>
                  ) : availableTools.length > 0 ? (
                    <div className="space-y-3">
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
                    <div className="flex items-center justify-center h-20">
                      <p className="text-gray-500 text-sm">
                        {isRefreshing ? 'Loading tools...' : 'No tools available or failed to load.'}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className={`h-full w-full ${configExpanded ? 'min-h-[500px]' : 'min-h-[600px]'}`}>
                  {spaceId && tenantId && apiKey ? (
                    <FastnWidget
                      projectId={spaceId}
                      tenantId={tenantId}
                      apiKey={apiKey}
                      theme="light"
                      env="LIVE"
                      style={{
                        height: '100%',
                        width: '100%',
                        border: 'none',
                        borderRadius: '8px',
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500 text-center text-sm px-4">
                        Enter Space ID, Tenant ID, and API Key to view available widgets.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;