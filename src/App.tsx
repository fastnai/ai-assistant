import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput, ChatInputHandles } from './components/ChatInput';
import { Message, Conversation, Tool } from './types';
import { getTools, executeTool } from './api';
import { getStreamingAIResponse, getToolExecutionResponse } from './llmCall';
import { PlayCircle, RefreshCw, ChevronRight, ChevronLeft, Wrench, Trash2, KeyRound, Fingerprint, LayoutGrid, ChevronDown, ChevronUp, User, Lock, Eye, EyeOff, LogOut, Bot } from 'lucide-react';
import FastnWidget from '@fastn-ai/widget-react';
import { useAuth } from "react-oidc-context";
import { ToggleTabs } from './components/ToggleTabs';
import AuthBox from './components/AuthBox';
import { Tooltip } from "react-tooltip";

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
  const [widgetKey, setWidgetKey] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State for API Key and Space ID, loaded from localStorage
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('fastnApiKey') || '');
  const [spaceId, setSpaceId] = useState<string>(() => localStorage.getItem('fastnSpaceId') || '');
  // State for model selection, loaded from localStorage
  const [tenantId, setTenantId] = useState<string>(() => localStorage.getItem('fastnTenantId') || '');
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    // Force reset to gpt-4o
    localStorage.setItem('fastnSelectedModel', 'gpt-4o');
    return 'gpt-4o';
  });
  // State for username and password
  const [username, setUsername] = useState<string>(() => localStorage.getItem('fastnUsername') || '');
  const [password, setPassword] = useState<string>(() => localStorage.getItem('fastnPassword') || '');
  const [authToken, setAuthToken] = useState<string>(() => localStorage.getItem('fastnAuthToken') || '');
  const [refreshToken, setRefreshToken] = useState<string>(() => localStorage.getItem('fastnRefreshToken') || '');
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(() => 
    (localStorage.getItem('fastnAuthStatus') as 'idle' | 'loading' | 'success' | 'error') || 'idle'
  );
  const [authErrorMessage, setAuthErrorMessage] = useState<string>('');
  const [tokenExpiryTime, setTokenExpiryTime] = useState<number>(() => {
    const saved = localStorage.getItem('fastnTokenExpiryTime');
    return saved ? parseInt(saved) : 0;
  });
  const [refreshTokenExpiryTime, setRefreshTokenExpiryTime] = useState<number>(() => {
    const saved = localStorage.getItem('fastnRefreshTokenExpiryTime');
    return saved ? parseInt(saved) : 0;
  });

  const [sidebarView, setSidebarView] = useState<'tools' | 'apps' | 'config'>('config');
  const [widgetMounted, setWidgetMounted] = useState<boolean>(false);
  const [widgetResponses, setWidgetResponses] = useState<any[]>([]);
  const [connectorsDataNull, setConnectorsDataNull] = useState<boolean | null>(null);
  const widgetIframeRef = useRef<HTMLIFrameElement | null>(null);
  const auth = useAuth();
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

  // State to control the authentication box expansion
  const [authBoxExpanded, setAuthBoxExpanded] = useState<boolean>(() => authStatus !== 'success');
  
  // Close the auth box when user logs in
  useEffect(() => {
    if (authStatus === 'success') {
      setAuthBoxExpanded(false);
    } else {
      setAuthBoxExpanded(true);
    }
  }, [authStatus]);

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

  useEffect(() => {
    localStorage.setItem('fastnUsername', username);
  }, [username]);

  useEffect(() => {
    localStorage.setItem('fastnPassword', password);
  }, [password]);
  
  useEffect(() => {
    localStorage.setItem('fastnAuthToken', authToken);
  }, [authToken]);
  
  useEffect(() => {
    localStorage.setItem('fastnRefreshToken', refreshToken);
  }, [refreshToken]);
  
  useEffect(() => {
    localStorage.setItem('fastnAuthStatus', authStatus);
  }, [authStatus]);

  useEffect(() => {
    localStorage.setItem('fastnTokenExpiryTime', tokenExpiryTime.toString());
  }, [tokenExpiryTime]);

  useEffect(() => {
    localStorage.setItem('fastnRefreshTokenExpiryTime', refreshTokenExpiryTime.toString());
  }, [refreshTokenExpiryTime]);

  // Add ref for ChatInput
  const chatInputRef = useRef<ChatInputHandles>(null);

  // Function to handle logout
  const handleLogout = () => {
    // Clear authentication data
    setAuthToken('');
    setRefreshToken('');
    setAuthStatus('idle');
    setTokenExpiryTime(0);
    setRefreshTokenExpiryTime(0);
    // Clear user credentials
    setUsername('');
    setPassword('');
    setTenantId('');
    setSpaceId('');
    // Clear localStorage data
    localStorage.removeItem('fastnAuthToken');
    localStorage.removeItem('fastnRefreshToken');
    localStorage.removeItem('fastnAuthStatus');
    localStorage.removeItem('fastnTokenExpiryTime');
    localStorage.removeItem('fastnRefreshTokenExpiryTime');
    localStorage.removeItem('conversation');
    localStorage.removeItem('fastnUsername');
    localStorage.removeItem('fastnPassword');
    localStorage.removeItem('fastnTenantId');
    localStorage.removeItem('fastnSpaceId');
    localStorage.setItem('fastnAuthStatus', 'idle');
    setToolResults({});
    // Clear the input field
    chatInputRef.current?.resetMessage();
    // Expand the auth box
    setAuthBoxExpanded(true);
    // Clear tools and apps data
    setAvailableTools([]);
    setWidgetMounted(false);
    setWidgetKey(prevKey => prevKey + 1);
    setWidgetResponses([]);
    setConnectorsDataNull(null);
    // Switch to config view
    setSidebarView('config');
    // Clear conversation
    setConversation({ messages: [] });
    console.log('User logged out');
  };

  // Add state for tracking input focus
  const [isSpaceIdFocused, setIsSpaceIdFocused] = useState(false);
  const [isTenantIdFocused, setIsTenantIdFocused] = useState(false);

  // Function to handle Space ID change
  const handleSpaceIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpaceId = e.target.value;
    setSpaceId(newSpaceId);
    
    // Clear tools and related data when Space ID changes
    setAvailableTools([]);
    setConversation({ messages: [] });
    setToolResults({});
  };

  // Function to handle Tenant ID change
  const handleTenantIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTenantId = e.target.value;
    setTenantId(newTenantId);
    
    // Reset widget data when Tenant ID changes
    setWidgetMounted(false);
    setWidgetKey(prevKey => prevKey + 1);
  };

  // Add debounced functions for loading tools and widgets after typing
  const [debouncedLoadExecutor, setDebouncedLoadExecutor] = useState<NodeJS.Timeout | null>(null);

  // Effect to load tools and widgets after user finishes typing and unfocuses
  useEffect(() => {
    // Clear any existing timeout
    if (debouncedLoadExecutor) {
      clearTimeout(debouncedLoadExecutor);
    }
    
    // Only proceed if neither field is focused
    const isAnyFieldFocused = isSpaceIdFocused || isTenantIdFocused;
    
    // If both values are provided and user is authenticated, set a new timeout
    if (authStatus === 'success' && authToken && spaceId?.trim() && tenantId?.trim() && !isAnyFieldFocused) {
      const timeoutId = setTimeout(() => {
        loadTools();
        // loadWidgets(); // Don't auto-load widgets
        // Navigate to apps tab if both Space ID and Tenant ID are provided
        setSidebarView('apps');
      }, 500); // 500ms debounce
      
      setDebouncedLoadExecutor(timeoutId);
    } else if (authStatus === 'success' && authToken && spaceId?.trim() && !isAnyFieldFocused) {
      // If only Space ID is provided, just load tools
      const timeoutId = setTimeout(() => {
        loadTools();
      }, 500); // 500ms debounce
      
      setDebouncedLoadExecutor(timeoutId);
    }
    
    // Cleanup function to clear the timeout when component unmounts or dependencies change
    return () => {
      if (debouncedLoadExecutor) {
        clearTimeout(debouncedLoadExecutor);
      }
    };
  }, [spaceId, tenantId, authStatus, authToken, isSpaceIdFocused, isTenantIdFocused]);

  // Function to fetch auth token when username and password are available
  const fetchAuthToken = async (forceRefresh = false) => {
    if (!username || !password) {
      setAuthStatus('idle');
      return;
    }
    
    // If we already have an auth token and successful status, no need to re-authenticate
    // Unless forceRefresh is true (e.g., when login button is clicked)
    if (authToken && authStatus === 'success' && !forceRefresh) {
      console.log('Already authenticated with token');
      return;
    }
    
    try {
      setAuthStatus('loading');
      setAuthErrorMessage('');
      
      // Using the new API endpoint
      const response = await fetch('https://live.fastn.ai/api/v1/generateFastnAccessToken', {
        method: 'POST',
        headers: {
          'x-fastn-api-key': "21112588-769a-4311-a359-cf094bee5382",
          'Content-Type': 'application/json',
          'x-fastn-space-id': "43aea445-7772-4e45-b1e8-548b96c4bf2b",
          'x-fastn-space-tenantid': '',
          'stage': 'LIVE'
        },
        body: JSON.stringify({ 
          input: {
            username: username,
            password: password
          } 
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || `Auth API error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Auth token response:', data);
      
      // Extract the access_token directly from the response
      const accessToken = data.access_token;
      const refreshTokenValue = data.refresh_token;
      const expiresIn = data.expires_in;
      const refreshExpiresIn = data.refresh_expires_in;
      
      console.log('Using access token:', accessToken);
      
      if (!accessToken) {
        throw new Error('No access token received from authentication server');
      }
      
      // Calculate and set token expiry times
      const now = Date.now();
      setTokenExpiryTime(now + (parseInt(String(expiresIn)) * 1000)); // Convert seconds to milliseconds
      setRefreshTokenExpiryTime(now + (parseInt(String(refreshExpiresIn)) * 1000)); // Convert seconds to milliseconds
      
      setAuthToken(accessToken);
      setRefreshToken(refreshTokenValue);
      setAuthStatus('success');
      
      // Close the auth box on successful login
      setAuthBoxExpanded(false);
      
      // Load tools once authenticated
      await loadTools();
    } catch (error) {
      console.error('Error fetching auth token:', error);
      // Clear the token and status if authentication fails
      setAuthToken('');
      setRefreshToken('');
      setAuthStatus('error');
      setAuthErrorMessage('Authentication failed');
    }
  };

  // Just checking if we have saved credentials on mount 
  useEffect(() => {
    if (username && password && authStatus === 'idle') {
      console.log('Credentials found, trying to authenticate automatically');
      fetchAuthToken(false); // Don't force refresh on initial load
    } else if (authStatus === 'success' && authToken) {
      console.log('Already authenticated, loading tools');
      loadTools();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Make sure unauthenticated users stay on the config tab
  useEffect(() => {
    if (authStatus !== 'success' && sidebarView !== 'config') {
      setSidebarView('config');
    }
  }, [authStatus, sidebarView]);

  const [isToolsRefreshing, setIsToolsRefreshing] = useState(false);
  const [isAppsRefreshing, setIsAppsRefreshing] = useState(false);

  const loadTools = async () => {
    // Verify we have a valid authentication token
    if (authStatus !== 'success' || !authToken) {
      setError('Authentication required to load tools.');
      return;
    }
    console.log('Loading tools');
    // Check if token is valid, refresh if needed
    const isTokenValid = await ensureValidToken();
    if (!isTokenValid) {
      setError('Authentication failed. Please log in again.');
      return;
    }
    
    // Check if Space ID is provided
    if (!spaceId?.trim()) {
      setError('Space ID is required to load tools.');
      return;
    }
    
    try {
      setIsToolsRefreshing(true);
      setError(null);
      // Pass apiKey and spaceId to getTools

      const tools = await getTools('chat', spaceId, authToken, tenantId);

      setAvailableTools(tools);
    } catch (error) {
      console.error('Error loading tools:', error);
      handleApiError(error);
      setError('Failed to load tools. Please try refreshing.');
      setAvailableTools([]); // Clear tools on error
    } finally {
      setIsToolsRefreshing(false);
    }
  };

  const loadWidgets = async () => {
    if (!tenantId) {
      setError('Tenant ID is required to load Apps.');
      return;
    }
    
    // Check if Space ID is provided
    if (!spaceId?.trim()) {
      setError('Space ID is required to load Apps.');
      return;
    }
    
    // Verify we have a valid authentication token
    if (authStatus !== 'success' || !authToken) {
      setError('Authentication required to load Apps.');
      return;
    }
    
    // Check if token is valid, refresh if needed
    const isTokenValid = await ensureValidToken();
    if (!isTokenValid) {
      setError('Authentication failed. Please log in again.');
      return;
    }
    
    try {
      setIsAppsRefreshing(true);
      setError(null);
      // Reset connectors data status when reloading
      setConnectorsDataNull(false);
      
      // Instead of making an API call to check connectors, we'll mount the widget
      // and rely on the message event listener to determine if connectors are available
      console.log('Setting up widget to detect connector availability');
      
      // Force remount of the FastnWidget component
      setWidgetMounted(false);
      // setTimeout(() => {
      //   setWidgetKey(prevKey => prevKey + 1);
      //   setWidgetMounted(true);
      // }, 3000); // Check after 3 seconds
      
    } catch (error) {
      console.error('Error loading apps:', error);
      handleApiError(error);
      setError('Failed to load apps. Please try refreshing.');
    } finally {
      setIsAppsRefreshing(false);
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
    // Verify we have a valid authentication token
    if (authStatus !== 'success' || !authToken) {
      setError('Authentication required to send messages.');
      setIsLoading(false);
      return;
    }
    
    // Check if token is valid, refresh if needed
    const isTokenValid = await ensureValidToken();
    if (!isTokenValid) {
      setError('Authentication failed. Please log in again.');
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
        selectedModel,
        spaceId
      ).catch(error => {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        handleApiError(error);
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
      handleApiError(error);
      setError(errorMessage);
      addMessage('assistant', `Error: ${errorMessage}`);
      setIsLoading(false);
    }
  };

  const handleExecuteTool = async (actionData: any) => {
    // Verify we have a valid authentication token
    if (authStatus !== 'success' || !authToken) {
      setError('Authentication required to execute tools.');
      setIsLoading(false);
      return;
    }
    
    // Check if token is valid, refresh if needed
    const isTokenValid = await ensureValidToken();
    if (!isTokenValid) {
      setError('Authentication failed. Please log in again.');
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
        authToken,   
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
        selectedModel,
        spaceId
      ).catch(error => {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        handleApiError(error);
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
      handleApiError(error);
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

  // Function to validate the current auth token
  const validateAuthToken = async () => {
    return await ensureValidToken();
  };
  
  // Handle API errors related to authentication
  const handleApiError = (error: any) => {
    // Extract status code if it's an axios error with response
    const status = error.response?.status || error.status;
    const message = error.message || '';
    
    // Check if the error is an authentication error
    const isAuthError = status === 401 || 
                        message.includes('auth') || 
                        message.includes('token') ||
                        message.includes('unauthorized') ||
                        message.includes('unauthenticated');
    
    if (isAuthError) {
      console.error('Authentication error detected:', error);
      
      // Attempt to refresh the token
      refreshAccessToken()
        .then(success => {
          console.log(`Token refresh ${success ? 'succeeded' : 'failed'} after API error`);
          if (!success) {
            // If refresh fails, logout the user
            console.error('Token refresh failed, logging out user');
            handleLogout();
          }
        })
        .catch(refreshError => {
          console.error('Error during token refresh after API error:', refreshError);
          handleLogout();
        });
    }
    return error;
  };

  // Verify token on initial load and when dependencies change
  useEffect(() => {
    if (authToken && authStatus === 'success') {
      validateAuthToken().catch(handleApiError);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add state for password
  const [showPassword, setShowPassword] = useState(false);

  // Effect to initialize widget when first visiting widgets tab
  useEffect(() => {
    if (sidebarView === 'apps' && !widgetMounted && authStatus === 'success' && tenantId && authToken) {
      setWidgetMounted(true);
      
      // Set up window message listener to capture widget responses
      const handleWidgetMessage = (event: MessageEvent) => {
        try {
          // Log all messages from potential widget origin
          console.log('Received window message:', event);
          
          // Check if the message is from the FastnWidget
          if (event.data && typeof event.data === 'object') {
            console.log('Widget response:', event.data);
            
            // Check specifically for connectors data being null or empty array
            if (event.data.type === 'CONNECTORS_DATA') {
              if (
                  event.data.data === null || 
                  (Array.isArray(event.data.data) && event.data.data.length === 0) ||
                  (typeof event.data.data === 'object' && Object.keys(event.data.data).length === 0)
                ) {
                console.log('Connectors data is null or empty array');
                setConnectorsDataNull(true); // No connectors available
              } else {
                console.log('Connectors data is available');
                setConnectorsDataNull(false); // Connectors are available
              }
            }
            
            // No need to check for no_connector_found event here as we have a dedicated listener
            
            // Store widget responses with timestamp
            setWidgetResponses(prev => [
              ...prev, 
              { 
                timestamp: new Date().toISOString(),
                data: event.data 
              }
            ]);
          }
        } catch (error) {
          console.error('Error processing widget message:', error);
        }
      };
      
      // Add event listener
      window.addEventListener('message', handleWidgetMessage);
      
      // Clean up event listener
      return () => {
        window.removeEventListener('message', handleWidgetMessage);
      };
    }
  }, [sidebarView, widgetMounted, authStatus, tenantId, authToken]);

  // Function to refresh access token using refresh token
  const refreshAccessToken = async () => {
    if (!refreshToken) {
      console.log('No refresh token available');
      handleLogout();
      return false;
    }

    // Check if refresh token is expired
    if (refreshTokenExpiryTime > 0 && Date.now() > refreshTokenExpiryTime) {
      console.log('Refresh token expired');
      handleLogout();
      return false;
    }

    try {
      console.log('Refreshing access token...');
      
      // Use the direct token refresh endpoint with URLSearchParams
      const formData = new URLSearchParams();
      formData.append('grant_type', 'refresh_token');
      formData.append('client_id', 'fastn-app');
      formData.append('refresh_token', refreshToken);
      
      const response = await fetch('https://live.fastn.ai/auth/realms/fastn/protocol/openid-connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      if (!response.ok) {
        console.error(`Failed to refresh token: ${response.status} ${response.statusText}`);
        // Try to get the error details from the response
        try {
          const errorData = await response.json();
          console.error('Token refresh error details:', errorData);
        } catch (parseError) {
          console.error('Could not parse error response');
        }
        
        // If status is 401, the refresh token itself is invalid
        if (response.status === 401) {
          console.error('Refresh token is invalid, logging out');
          handleLogout();
          return false;
        }
        
        // For other errors, we might want to retry or handle differently
        if (response.status >= 500) {
          console.error('Server error during token refresh, might retry later');
        } else {
          handleLogout();
        }
        return false;
      }

      const data = await response.json();
      console.log('Token refresh response received');
      
      if (!data.access_token) {
        console.error('No access token in refresh response');
        handleLogout();
        return false;
      }
      
      // Update tokens and expiry times
      setAuthToken(data.access_token);
      if (data.refresh_token) {
        setRefreshToken(data.refresh_token);
      }
      
      // Calculate and set token expiry times - note that values are in seconds
      const now = Date.now();
      const expiresIn = data.expires_in || 300; // Default to 5 minutes
      const refreshExpiresIn = data.refresh_expires_in || 3600; // Default to 1 hour
      
      const newTokenExpiryTime = now + (expiresIn * 1000); // Convert seconds to milliseconds
      const newRefreshTokenExpiryTime = now + (refreshExpiresIn * 1000); // Convert seconds to milliseconds
      
      console.log(`New token expires in ${expiresIn} seconds`);
      setTokenExpiryTime(newTokenExpiryTime);
      setRefreshTokenExpiryTime(newRefreshTokenExpiryTime);
      
      console.log('Access token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      // Don't immediately logout on network errors - might be temporary
      if (error instanceof TypeError && error.message.includes('network')) {
        console.log('Network error during token refresh, will try again later');
        return false;
      } else {
        handleLogout();
        return false;
      }
    }
  };

  // Function to check token validity and refresh if needed
  const ensureValidToken = async () => {
    // If not authenticated, don't do anything
    if (authStatus !== 'success' || !authToken) {
      return false;
    }
    
    const now = Date.now();
    const timeUntilExpiry = tokenExpiryTime - now;
    
    // If token is valid and not about to expire, return true
    if (tokenExpiryTime > 0 && timeUntilExpiry > 0) {
      // If token will expire in less than 4 minutes (240000 ms), proactively refresh it
      if (timeUntilExpiry < 240000) {
        console.log(`Token will expire in ${Math.floor(timeUntilExpiry / 1000)} seconds - proactively refreshing`);
        return await refreshAccessToken();
      }
      return true;
    }
    
    // Token is expired, try to refresh
    return await refreshAccessToken();
  };

  // Check token validity periodically
  useEffect(() => {
    if (authStatus === 'success' && authToken) {
      console.log('Setting up token refresh interval check');
      const interval = setInterval(async () => {
        // Check if token is valid and if it needs to be refreshed
        await ensureValidToken();
      }, 240000); // Check every 30 seconds
      
      return () => {
        console.log('Clearing token refresh interval');
        clearInterval(interval);
      };
    }
  }, [authStatus, authToken, tokenExpiryTime, refreshToken]); // Add refreshToken to dependencies

  // Effect to check connector availability when tenantId or spaceId changes
  useEffect(() => {
    // We won't be using the getConnectors API anymore
    // Instead, we'll rely on widget loading and message event listeners
    // to determine connector availability
    if (tenantId && spaceId && authStatus === 'success' && authToken) {
      // Reset the state when changing tenant or space
      // setConnectorsDataNull(false);
      
      if (sidebarView === 'apps') {
        console.log('Tenant/Space changed - will check for connectors via widget events');
        // Reload the widget, which will trigger message events for connector availability
        setWidgetMounted(false);
        setWidgetKey(prevKey => prevKey + 1);
        setTimeout(() => {
          setWidgetMounted(true);
        }, 1000);
      }
    }
  }, [tenantId, spaceId, authStatus, authToken, sidebarView]);

  // Function to inspect widget iframe content
  const inspectWidgetContent = () => {
    try {
      // Try to find the iframe element that FastnWidget likely uses
      const iframes = document.querySelectorAll('iframe');
      console.log('Found iframes:', iframes);
      
      // Find iframe related to the widget (usually has fastn in the src)
      const widgetIframe = Array.from(iframes).find(iframe => 
        iframe.src && iframe.src.includes('fastn')
      );
      
      if (widgetIframe) {
        console.log('Widget iframe found:', widgetIframe);
        
        try {
          // Try to access the iframe's document (may throw security error due to same-origin policy)
          const iframeDocument = widgetIframe.contentDocument || widgetIframe.contentWindow?.document;
          console.log('Widget iframe document:', iframeDocument);
          
          // Store response to show in UI
          setWidgetResponses(prev => [
            ...prev, 
            { 
              timestamp: new Date().toISOString(),
              data: { 
                type: 'iframe_inspection',
                success: true,
                message: 'Iframe content inspected. See console for details.'
              } 
            }
          ]);
        } catch (securityError) {
          console.error('Security error accessing iframe content:', securityError);
          setWidgetResponses(prev => [
            ...prev, 
            { 
              timestamp: new Date().toISOString(),
              data: { 
                type: 'iframe_inspection_error',
                success: false,
                message: 'Security error accessing iframe content. Widget likely uses a different origin.'
              } 
            }
          ]);
        }
      } else {
        console.log('Widget iframe not found');
        setWidgetResponses(prev => [
          ...prev, 
          { 
            timestamp: new Date().toISOString(),
            data: { 
              type: 'iframe_not_found',
              success: false,
              message: 'Could not find FastnWidget iframe'
            } 
          }
        ]);
      }
    } catch (error) {
      console.error('Error inspecting widget content:', error);
      setWidgetResponses(prev => [
        ...prev, 
        { 
          timestamp: new Date().toISOString(),
          data: { 
            type: 'inspection_error',
            success: false,
            error: String(error)
          } 
        }
      ]);
    }
  };

  // Function to monitor widget iframe console outputs
  const monitorWidgetConsole = () => {
    try {
      // Try to find the iframe element that FastnWidget likely uses
      const iframes = document.querySelectorAll('iframe');
      const widgetIframe = Array.from(iframes).find(iframe => 
        iframe.src && iframe.src.includes('fastn')
      );
      
      if (widgetIframe && widgetIframe.contentWindow) {
        console.log('Attempting to monitor widget console output');
        
        try {
          // Try to inject script to override console methods
          // Note: This might not work due to security restrictions
          const script = document.createElement('script');
          script.textContent = `
            // Store original console methods
            const originalConsole = {
              log: console.log,
              error: console.error,
              warn: console.warn,
              info: console.info
            };
            
            // Override console methods to send messages to parent
            console.log = function() {
              // Call original method
              originalConsole.log.apply(console, arguments);
              // Send to parent
              window.parent.postMessage({
                type: 'widget_console',
                method: 'log',
                args: Array.from(arguments).map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg)
              }, '*');
            };
            
            console.error = function() {
              originalConsole.error.apply(console, arguments);
              window.parent.postMessage({
                type: 'widget_console',
                method: 'error',
                args: Array.from(arguments).map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg)
              }, '*');
            };
            
            console.warn = function() {
              originalConsole.warn.apply(console, arguments);
              window.parent.postMessage({
                type: 'widget_console',
                method: 'warn',
                args: Array.from(arguments).map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg)
              }, '*');
            };
            
            console.info = function() {
              originalConsole.info.apply(console, arguments);
              window.parent.postMessage({
                type: 'widget_console',
                method: 'info',
                args: Array.from(arguments).map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg)
              }, '*');
            };
            
            window.parent.postMessage({
              type: 'widget_console',
              method: 'info',
              args: ['Console monitoring initialized']
            }, '*');
          `;
          
          try {
            widgetIframe.contentDocument?.head.appendChild(script);
            setWidgetResponses(prev => [
              ...prev, 
              { 
                timestamp: new Date().toISOString(),
                data: { 
                  type: 'console_monitor_setup',
                  success: true,
                  message: 'Console monitoring script injected. Widget console outputs will appear here.'
                } 
              }
            ]);
          } catch (injectError) {
            console.error('Error injecting console monitor script:', injectError);
            setWidgetResponses(prev => [
              ...prev, 
              { 
                timestamp: new Date().toISOString(),
                data: { 
                  type: 'console_monitor_error',
                  success: false,
                  message: 'Could not inject console monitoring script due to security restrictions.',
                  error: String(injectError)
                } 
              }
            ]);
          }
        } catch (securityError) {
          console.error('Security error accessing iframe for console monitoring:', securityError);
          setWidgetResponses(prev => [
            ...prev, 
            { 
              timestamp: new Date().toISOString(),
              data: { 
                type: 'console_monitor_security_error',
                success: false,
                message: 'Security error accessing iframe for console monitoring.',
                error: String(securityError)
              } 
            }
          ]);
        }
      } else {
        console.log('Widget iframe not found for console monitoring');
        setWidgetResponses(prev => [
          ...prev, 
          { 
            timestamp: new Date().toISOString(),
            data: { 
              type: 'iframe_not_found',
              success: false,
              message: 'Could not find FastnWidget iframe for console monitoring'
            } 
          }
        ]);
      }
    } catch (error) {
      console.error('Error setting up console monitoring:', error);
      setWidgetResponses(prev => [
        ...prev, 
        { 
          timestamp: new Date().toISOString(),
          data: { 
            type: 'console_monitor_setup_error',
            success: false,
            error: String(error)
          } 
        }
      ]);
    }
  };

  // Function to trigger widget API communication
  const testWidgetAPI = () => {
    try {
      // Record that we're triggering the test
      setWidgetResponses(prev => [
        ...prev, 
        { 
          timestamp: new Date().toISOString(),
          data: { 
            type: 'api_test_trigger',
            message: 'Attempting to trigger widget API communication. Check console for messages.'
          } 
        }
      ]);
      
      // Try to find the iframe element that FastnWidget likely uses
      const iframes = document.querySelectorAll('iframe');
      const widgetIframe = Array.from(iframes).find(iframe => 
        iframe.src && iframe.src.includes('fastn')
      );
      
      if (widgetIframe && widgetIframe.contentWindow) {
        console.log('Found widget iframe for API test:', widgetIframe);
        
        // Send a message to the widget iframe to trigger API communication
        widgetIframe.contentWindow.postMessage({
          type: 'widget_api_test',
          command: 'fetch_data',
          timestamp: Date.now()
        }, '*');
        
        // Try to access iframe content to trigger more actions
        try {
          // This may fail due to cross-origin restrictions
          const iframeDocument = widgetIframe.contentDocument || widgetIframe.contentWindow?.document;
          
          if (iframeDocument) {
            // Try to find buttons or links that might trigger API calls
            const buttons = iframeDocument.querySelectorAll('button');
            const links = iframeDocument.querySelectorAll('a');
            
            console.log('Found widget buttons:', buttons);
            console.log('Found widget links:', links);
            
            // Try to click the first button to trigger action
            if (buttons.length > 0) {
              console.log('Attempting to click first button');
              buttons[0].click();
            }
            
            // Try to trigger iframe reload which might cause API calls
            widgetIframe.contentWindow.location.reload();
          }
        } catch (securityError) {
          console.error('Security error accessing iframe content for API test:', securityError);
        }
      } else {
        console.log('Widget iframe not found for API test');
        setWidgetResponses(prev => [
          ...prev, 
          { 
            timestamp: new Date().toISOString(),
            data: { 
              type: 'iframe_not_found',
              success: false,
              message: 'Could not find FastnWidget iframe for API test'
            } 
          }
        ]);
      }
    } catch (error) {
      console.error('Error during widget API test:', error);
      setWidgetResponses(prev => [
        ...prev, 
        { 
          timestamp: new Date().toISOString(),
          data: { 
            type: 'api_test_error',
            success: false,
            error: String(error)
          } 
        }
      ]);
    }
  };

  // Function to simulate null connectors data
  const simulateNullConnectors = () => {
    setConnectorsDataNull(true); // Set to true (no connectors)
    setWidgetResponses(prev => [
      ...prev, 
      { 
        timestamp: new Date().toISOString(),
        data: { 
          type: 'SIMULATED_NULL_CONNECTORS',
          message: 'Simulated null connectors data. Widget display should update to show "No apps available".'
        } 
      }
    ]);
  };

  // Effect to check for empty connectors data when viewing the apps tab
  useEffect(() => {
    if (sidebarView === 'apps' && authStatus === 'success' && widgetResponses.length > 0) {
      // Check if we have any responses with empty connectors data
      const hasEmptyConnectors = widgetResponses.some(response => 
        response.data?.type === 'CONNECTORS_DATA' && 
        (!response.data.data || 
         (Array.isArray(response.data.data) && response.data.data.length === 0) ||
         (typeof response.data.data === 'object' && Object.keys(response.data.data || {}).length === 0))
      );
      
      if (hasEmptyConnectors) {
        console.log('Empty connectors data detected in responses');
        setConnectorsDataNull(true);
      }
    }
  }, [sidebarView, authStatus, widgetResponses]);

  // Effect to specifically listen for the no_connector_found event
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && event.data.eventType === "no_connector_found") {
        console.log('No connector found event detected in dedicated listener');
        setConnectorsDataNull(true); // No connectors available
        
        // Show message for user by adding to widget responses
        setWidgetResponses(prev => [
          ...prev, 
          { 
            timestamp: new Date().toISOString(),
            data: { 
              type: 'NO_CONNECTOR_FOUND_DEDICATED',
              message: 'No connectors available. Please activate connectors in MCP.',
              source: 'dedicated_listener'
            } 
          }
        ]);
      }
    };
    
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Effect to specifically listen for connector-related events
  useEffect(() => {
    const handleConnectorEvents = (event: MessageEvent) => {
      // Only process if we have data and it's an object
      if (event.data && typeof event.data === 'object') {
        
        // Handle explicit no_connector_found event
        if (event.data.eventType === "no_connector_found") {
          console.log('No connector found event detected in dedicated listener');
          setConnectorsDataNull(true); // No connectors available
          
          // Show message for user by adding to widget responses
          setWidgetResponses(prev => [
            ...prev, 
            { 
              timestamp: new Date().toISOString(),
              data: { 
                type: 'NO_CONNECTOR_FOUND_DEDICATED',
                message: 'No connectors available. Please activate connectors in MCP.',
                source: 'dedicated_listener'
              } 
            }
          ]);
        }
        
        // Also check for empty connector data responses
        if (event.data.type === 'CONNECTORS_DATA') {
          const connectorsData = event.data.data;
          const isEmpty = !connectorsData || 
                         (Array.isArray(connectorsData) && connectorsData.length === 0) ||
                         (typeof connectorsData === 'object' && Object.keys(connectorsData || {}).length === 0);
          
          if (isEmpty) {
            console.log('Empty connectors data detected in dedicated listener');
            setConnectorsDataNull(true); // No connectors available
            
            // Add to widget responses
            setWidgetResponses(prev => [
              ...prev, 
              { 
                timestamp: new Date().toISOString(),
                data: { 
                  type: 'EMPTY_CONNECTORS_DATA',
                  message: 'No connectors available. Please activate connectors in MCP.',
                  source: 'dedicated_listener'
                } 
              }
            ]);
          } else {
            console.log('Connectors data available in dedicated listener');
            setConnectorsDataNull(false); // Connectors are available
          }
        }
      }
    };
    
    window.addEventListener("message", handleConnectorEvents);
    return () => {
      window.removeEventListener("message", handleConnectorEvents);
    };
  }, []);
  console.log(connectorsDataNull)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      {/* Main content area */}
      <div className="flex h-screen overflow-hidden justify-center">
        {/* Chat area */}
        <div className={`flex-1 flex flex-col ${sidebarVisible ? 'mr-[500px]' : ''} transition-all duration-300 max-w-[1000px] ${conversation.messages.length === 0 ? 'py-[130px]' : 'h-full'}`}>
          {/* Header */}
          <div className="flex flex-col items-center pt-6 pb-4">
            <Bot 
              className="w-16 h-16 rounded-full mb-3 shadow-md p-3 bg-gradient-to-tr from-[#b857ce] via-[#d04fad] to-[#f9a254] text-white" 
            />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">AI Assistant</h1>
           
          </div>
          
          {/* Error message */}
          {/* {error && (
            <div className="mx-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )} */}
          
          {/* Chat messages */}
          <div className={`flex-1  px-4 ${conversation.messages.length === 0 ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
            <div className={`bg-white rounded-lg shadow-md px-4 h-full space-y-4 relative ${conversation.messages.length === 0 ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
            {conversation.messages.length > 0 &&<div className='w-full py-0.5 bg-white sticky left-0 top-0  z-20 justify-between flex flex-row'>
              <div></div>
              <button
                onClick={clearConversation}
                className="p-2 text-red-500 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors"
                title="Clear chat"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>}
              {conversation.messages.length === 0 ? (
                <div className="flex flex-col h-full items-center justify-center text-gray-600 text-[17px]">
                  {authStatus !== 'success' ? (
                    <div className="max-w-sm text-center">
                      <p>Please log in to start a conversation</p>
                    </div>
                  ) : availableTools.length === 0 ? (
                    <div className="max-w-sm text-center">
                      <p>No tools available</p>
                    </div>
                  ) : (
                    <div className="max-w-sm text-center text-indigo-700">
                      <p>Send a message to start the conversation</p>
                    </div>
                  )}
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
            <div className={`bg-white rounded-lg shadow-md px-2 py-2 ${(authStatus !== 'success' || availableTools.length === 0) ? 'bg-opacity-75' : ''}`}>
              <ChatInput 
                ref={chatInputRef}
                onSendMessage={handleSendMessage} 
                disabled={isLoading || authStatus !== 'success' || availableTools.length === 0} 
                className={authStatus !== 'success' || availableTools.length === 0 ? 'opacity-50' : ''}
                authStatus={authStatus}
                
              />
              {isLoading && !streamingText && (
                <div className="text-center mt-2 text-sm text-gray-500">
                  <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-[#5B5EF0] border-r-transparent align-[-0.125em] mr-2"></div>
                  Processing your request...
                </div>
              )}
              {/* {authStatus !== 'success' && (
                <div className="text-center mt-2 text-sm text-amber-600">
                  Please log in to send messages
                </div>
              )}
              {authStatus === 'success' && availableTools.length === 0 && (
                <div className="text-center mt-2 text-sm text-amber-600">
                  No tools available - unable to process messages
                </div>
              )} */}
            </div>
          </div>
        </div>

        {/* Sidebar Toggle Button */}
        <button 
          onClick={toggleSidebar} 
          className="fixed right-[500px] top-1/2 transform -translate-y-1/2 bg-[#e8eaff] text-indigo-700 p-2 rounded-l-lg shadow-md hover:bg-indigo-200 z-30"
          style={{ right: sidebarVisible ? '500px' : '0' }}
        >
          {sidebarVisible ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>

        {/* Tools Sidebar */}
        <div 
          className={`fixed top-0 right-0 my-5 w-[500px] bg-white shadow-md h-screen transition-transform duration-300 rounded-l-lg z-20 ${
            sidebarVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="h-full overflow-y-auto p-4 flex flex-col">
            {/* Toggle between Config, Tools, and Widgets */}
            <div className="flex mb-1 pb-4">
              <ToggleTabs
                selectedTab={sidebarView}
                setSelectedTab={(id) => {
                  if (authStatus === 'success' || id === 'config') {
                    setSidebarView(id as 'tools' | 'apps' | 'config');
                    
                    // Call loadTools when switching to tools tab
                    if (id === 'tools' && authStatus === 'success') {
                      loadTools();
                    }
                    
                    // Remove automatic widget loading when switching to apps tab
                    // User can use the refresh button if needed
                  }
                }}
                tabs={[
                  {
                    id: 'config',
                    name: 'Config',
                    icon: <KeyRound className="w-4 h-4" />
                  },
                  
                  {
                    id: 'apps',
                    name: 'Apps',
                    icon: <LayoutGrid className="w-4 h-4" />,
                    disabled: authStatus !== 'success' || !tenantId?.trim() || !spaceId?.trim(),
                    disabledReason: authStatus !== 'success' 
                      ? "Please log in to access Apps" 
                      : !tenantId?.trim() 
                        ? "Tenant ID is required to access Apps" 
                        : !spaceId?.trim() 
                          ? "Space ID is required to access Apps" 
                          : ""
                  },{
                    id: 'tools',
                    name: 'Tools',
                    icon: <Wrench className="w-4 h-4" />,
                    disabled: authStatus !== 'success' || !spaceId?.trim(),
                    disabledReason: authStatus !== 'success'
                      ? "Please log in to access Tools"
                      : !spaceId?.trim()
                        ? "Space ID is required to access Tools"
                        : ""
                  }
                ]}
                className="w-full"
              />
            </div>

            {/* Authentication required message */}
            {authStatus !== 'success' && (
              <div className="mb-4 text-amber-600 bg-amber-50 border border-amber-200 p-3 rounded-md text-sm flex items-start">
                <div className="mr-2 flex-shrink-0">⚠️</div>
                <div>Please log in to access Tools and Apps</div>
              </div>
            )}

            {/* Content based on selected view */}
            <div className="flex-1 overflow-y-auto">
              {sidebarView === 'tools' ? (
                <>
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-bold">Available Tools</h2>
                    <button
                      onClick={loadTools}
                      disabled={isToolsRefreshing}
                      className="p-2 rounded-full hover:bg-gray-100"
                      title="Refresh Tools"
                    >
                      <RefreshCw className={`w-5 h-5 ${isToolsRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  
                  {availableTools.length > 0 ? (
                    <div className="space-y-3 pb-4">
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
                    isToolsRefreshing ? (
                      <div className="flex items-center justify-center h-20">
                        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-indigo-600 border-r-transparent align-[-0.125em] mr-2"></div>
                        <p className="text-gray-600">Loading tools...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 border border-gray-200 rounded-lg  space-y-4">
                        <div className="p-4 bg-indigo-100 rounded-full">
                          <Wrench className="w-8 h-8 text-indigo-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">No Tools Available</h3>
                        
                        <p className="text-gray-600 max-w-md">
                          
                          <span className="block mt-3">To set them up, go to the <span className="font-semibold">MCP page</span>, select the relevant <span className="font-semibold">connector</span>, and choose the tools you want to enable.</span>
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center mt-2">
                          <a 
                            href={`https://live.fastn.ai/app/projects/${spaceId}/ucl`} 
                            target="_blank" 
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center"
                          >
                             Add Tools
                          </a>
                          
                        </div>
                      </div>
                    )
                  )}
                </>
              ) : sidebarView === 'apps' ? (
                <div className="h-full w-full min-h-[500px]">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-bold">Available Apps</h2>
                    <button
                      onClick={loadWidgets}
                      disabled={isAppsRefreshing || !tenantId}
                      className={`p-2 rounded-full hover:bg-gray-100 ${(!tenantId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={!tenantId ? "Enter Tenant ID to Load Apps" : "Refresh Apps"}
                    >
                      <RefreshCw className={`w-5 h-5 ${isAppsRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  {tenantId && authToken ? (
                    <>
                      {widgetMounted && (
                        <>
                          {!!connectorsDataNull ? (
                            <div className="flex flex-col items-center justify-center p-6 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                              <div className="p-4 bg-indigo-100 rounded-full">
                                <LayoutGrid className="w-8 h-8 text-indigo-600" />
                              </div>
                              <h3 className="text-lg font-semibold text-gray-800">No Apps Available</h3>
                              
                              <p className="text-gray-600 max-w-md">
                                <span className="block mt-3">To get started, head over to the MCP page and activate the connectors you need — such as <span className="font-semibold">Google Docs</span>, <span className="font-semibold">Slack</span>, <span className="font-semibold">HubSpot</span>, and more.</span>
                              </p>
                              <div className="flex flex-wrap gap-3 justify-center mt-2">
                                <a 
                                  href={`https://live.fastn.ai/app/projects/${spaceId}/ucl`} 
                                  target="_blank" 
                                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center"
                                >
                                  Go to MCP
                                </a>
                              </div>
                            </div>
                          ) : (
                            <FastnWidget
                              key={widgetKey}
                              projectId={spaceId}
                              authToken={authToken}
                              tenantId={tenantId}
                              apiKey={apiKey}
                              theme="light"
                              env="DRAFT&enableAIActionAgent=false"
                              style={{
                                height: '100%',
                                width: '100%',
                                border: 'none',
                                borderRadius: '8px',
                              }}
                            />
                          )}
                          
                          
                          {/* Response display panel */}
                          {/* {widgetResponses.length > 0 && (
                            <div className="mt-4 border border-gray-200 rounded-md bg-gray-50 p-2">
                              <div className="flex justify-between items-center mb-2">
                                <h3 className="text-sm font-semibold">Widget Responses ({widgetResponses.length})</h3>
                                <div className="flex space-x-2">
                                  <button 
                                    onClick={inspectWidgetContent}
                                    className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                                  >
                                    Inspect Widget
                                  </button>
                                  <button 
                                    onClick={monitorWidgetConsole}
                                    className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                                  >
                                    Monitor Console
                                  </button>
                                  <button 
                                    onClick={testWidgetAPI}
                                    className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                                  >
                                    Test API
                                  </button>
                                  <button 
                                    onClick={simulateNullConnectors}
                                    className="text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600"
                                  >
                                    Simulate Null
                                  </button>
                                  <button 
                                    onClick={() => setWidgetResponses([])}
                                    className="text-xs text-red-500 hover:underline"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                              <div className="max-h-40 overflow-y-auto text-xs">
                                {widgetResponses.slice().reverse().map((response, idx) => (
                                  <div key={idx} className="mb-2 border-b border-gray-200 pb-1">
                                    <div className="text-gray-500">{response.timestamp}</div>
                                    <pre className="whitespace-pre-wrap overflow-x-auto bg-white p-1 rounded">
                                      {JSON.stringify(response.data, null, 2)}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )} */}
                        </>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500 text-center text-sm px-4">
                        Enter Tenant ID to view available Apps.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                // Config View
                <div className="space-y-4">
                  <h2 className="text-xl font-bold mb-4">Configuration Settings</h2>
                  
                  <div className="space-y-3">
                    {/* Authentication section - always visible */}
                    
                    <AuthBox 
                      header={
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <div 
                              className={`w-3 h-3 rounded-full ${
                                authStatus === 'idle' ? 'bg-gray-400' : 
                                authStatus === 'loading' ? 'bg-yellow-400' : 
                                authStatus === 'success' ? 'bg-green-400' : 
                                'bg-red-400'
                              }`}
                            />
                            <h3 className="font-semibold">Authentication</h3>
                          </div>
                          {authStatus === 'success' && (
                            <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent toggling the box when clicking the logout button
                                handleLogout();
                              }}
                              className="p-1 rounded-full text-gray-600 hover:text-red-600"
                              data-tooltip-id="logout"
                              data-tooltip-content={"Logout"}
                            >
                              <LogOut className="w-4 h-4" />
                            </button>
                            <Tooltip
                            style={{
                              borderRadius: "4px",
                              border: "1px solid #000",
                              backgroundColor: "#000",
                              color: "#fff",
                              zIndex: 30,
                              fontSize: "12px",
                              padding: "4px 8px",
                              maxWidth: "80px"
                            }}
                            id="logout"
                            place="top"
                            delayHide={100}
                            delayShow={300}
                          /></>
                          )}
                        </div>
                      }
                      body={
                        <>
                          {/* Username & Password fields */}
                          <div className="space-y-3 mb-3">
                          <span className="text-sm text-red-600">
                          { 
                           authStatus === 'error' && (authErrorMessage || 'Authentication failed')
                           }
                        </span>
                            <div>
                              <label htmlFor="config-username" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                <User className="w-4 h-4 mr-1 text-gray-500" /> Username
                              </label>
                              <input
                                type="text"
                                id="config-username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your Username"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            </div>
                            <div>
                              <label htmlFor="config-password" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                <Lock className="w-4 h-4 mr-1 text-gray-500" /> Password
                              </label>
                              <div className="relative">
                                <input
                                  type={showPassword ? "text" : "password"}
                                  id="config-password"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  placeholder="Enter your Password"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm pr-10"
                                />
                                <button 
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                  aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => fetchAuthToken(true)}
                            disabled={!username || !password || authStatus === 'loading'}
                            className={`flex items-center justify-center w-full py-2 px-4 rounded-md text-white 
                              ${(!username || !password || authStatus === 'loading') 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-black hover:bg-white hover:text-black'}`}
                          >
                            {authStatus === 'loading' ? (
                              <>
                                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent align-[-0.125em] mr-2"></div>
                                Logging in...
                              </>
                            ) : (
                               authStatus === 'success'?'Reconnect':
                              'Login'
                            )}
                          </button>
                          
                          {authStatus !== 'success' && (
                            <div className="text-center mt-3">
                              <p className="text-sm text-gray-600">
                                Don't have an account? <a href="https://live.fastn.ai" className="text-indigo-700 hover:underline" target="_blank">Sign up here</a>
                              </p>
                            </div>
                          )}
                        </>
                      }
                      isCollapsible={true}
                      defaultExpanded={authStatus !== 'success'}
                      isExpanded={authBoxExpanded}
                      onToggle={(expanded) => setAuthBoxExpanded(expanded)}
                    />
                    {/* API Configuration - only visible when logged in */}
                    {authStatus === 'success' && (
                      <AuthBox 
                        header={
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">API Configuration</h3>
                          </div>
                        }
                        body={
                          <div className="space-y-3">
                            <div>
                              <label htmlFor="config-spaceId" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                <Fingerprint className="w-4 h-4 mr-1 text-gray-500" /> Space ID
                              </label>
                              <input
                                type="text"
                                id="config-spaceId"
                                value={spaceId}
                                onChange={handleSpaceIdChange}
                                onFocus={() => setIsSpaceIdFocused(true)}
                                onBlur={() => setIsSpaceIdFocused(false)}
                                placeholder="Enter your Space ID"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            </div>
                            <div>
                              <label htmlFor="config-tenantId" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                <KeyRound className="w-4 h-4 mr-1 text-gray-500" /> Tenant ID
                              </label>
                              <input
                                type="text"
                                id="config-tenantId"
                                value={tenantId}
                                onChange={handleTenantIdChange}
                                onFocus={() => setIsTenantIdFocused(true)}
                                onBlur={() => setIsTenantIdFocused(false)}
                                placeholder="Enter your Tenant ID"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                              />
                            </div>
                            <div>
                              <label htmlFor="config-selectedModel" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                <KeyRound className="w-4 h-4 mr-1 text-gray-500" /> Selected Model
                              </label>
                              <select
                                id="config-selectedModel"
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
                          </div>
                        }
                        isCollapsible={true}
                        defaultExpanded={true}
                      />
                    )}
                    
                    
                    {/* Credentials warning */}
                    {/* {authStatus === 'success' && (!tenantId) && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-2">
                        <p className="text-red-600 text-sm">Tenant ID is required to load and use apps.</p>
                      </div>
                    )} */}
                    
                    {/* Space ID warning */}
                    {/* {authStatus === 'success' && (!spaceId?.trim()) && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3 mt-2">
                        <p className="text-red-600 text-sm">Space ID is required to load and use tools and apps.</p>
                      </div>
                    )} */}
                    
                    {/* Credentials properly set confirmation */}
                  
                  </div>
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