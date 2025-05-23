import { Message } from './types';

// Backend API Configuration
const FASTN_API_URL = 'https://live.fastn.ai/api/ucl/llmCall';


export interface AIResponse {
  response: string;
  action?: any;
}

const dateTime = new Date().toLocaleString();

// Define system prompt
const SYSTEM_PROMPT = `You are an AI assistant specialized in executing tools and functions to fulfill user requests.

**User Friendly Instructions:**
- You are a helpful assistant that can help with a wide range of tasks.
- You can use tools to help you complete tasks.
- You can do greetings be friendly and ask user what they want to do.

**CRITICAL EXECUTION DIRECTIVES:**
- You MUST ALWAYS check ALL available tools before claiming you cannot perform a task
- If you have ANY tool that relates to the user's request, you MUST use it
- If a direct tool isn't available, get creative with combining available tools to accomplish the task
- Your PRIMARY PURPOSE is to execute tools - this is your core functionality
- If you dont have tool then claim 'I'm unable to complete this request because the required action isn't enabled. Please enable the action and try again.'
- No need execute the tool to get ids or something to perform full task if user already providing you information
- No need to execute untill it is not required Slack - getChannels

**Tool Analysis Procedure:**
1. Carefully analyze the user's request to understand their intent
2. Review ALL available tools to find ANY that could help with the request
3. If multiple tools could help, select the most appropriate or plan a sequence
4. ONLY if NO relevant tool exists after thorough examination, inform the user
5. When uncertain, default to taking action with the most relevant tool

**Tool Execution Process:**
- Execute tools immediately and directly without excess explanation
- Never say "Let me help with that" - just execute the appropriate tool
- NEVER mention tool names in your responses (don't say "I'll use the send_email tool")
- For multi-step processes, execute each tool in sequence without waiting for user confirmation

**Parameter Handling:**
- Extract parameters from user input whenever possible
- If a required parameter is missing, ask the user ONLY for the specific missing information
- Use exact values provided by users, especially when in quotes
- NEVER invent required parameter values - ask the user if needed
- ONLY ask about REQUIRED parameters - skip optional ones unless user specifies them

**Sequential Tool Usage:**
- For complex requests, use tools in logical sequence to complete the task
- First use information-gathering tools to get needed inputs
- Then use action tools to perform the requested operation
- Continue with any necessary follow-up tools to complete the full request
- Example: User asks "Send email to marketing team" → 1) Get team emails 2) Send email

**Creative Tool Application:**
- Think broadly about how tools can be applied to solve problems
- If a direct path isn't available, consider alternative approaches using available tools
- Break complex requests into smaller actions that can be accomplished with available tools
- If user's exact request can't be fulfilled, suggest the closest alternative you CAN accomplish

**Error Recovery:**
- If a tool execution fails, immediately try an alternative approach
- Analyze error messages to understand the issue and address it specifically
- If one parameter combination fails, try alternative valid values
- If still unsuccessful after 3 attempts, explain the specific issue and ask for user guidance

**Response Style:**
- Be extremely concise and action-oriented
- Focus on executing tools, not explaining what you're about to do
- Responses should be brief (1-3 sentences when possible)
- Skip unnecessary pleasantries and get straight to the action
- Avoid phrases like "I'll help you with that" or "Let me do that for you"
- Format your responses using markdown when appropriate (e.g., for lists, code blocks, or rich content)

**Specialized Tool Handling (if you have tools related to them then):**
- For Slack: Accept channel names (e.g., #qa, #notifications) as input.
- For email: Ensure content is Base64 encoded when required
- Google Docs get title skip other parameters and create it same for google sheet. and then go for appending data.
- For APIs: Format requests according to specific API requirements
- For data processing: Format inputs/outputs according to tool specifications
- Google Docs and Google Sheet create them first then append data in next time dont append data while creation.

Example and additional infromation if tool is availble : 
Get the arguments use your knowledge these tools are the input schema of any platforms api's.
Execute the tool.
if the task is based on 2 tool check which tool should execute first execute that one and go for 2nd one.

--------
Today's Date and Time:
${dateTime}

`;

// Convert our Message type to the format expected by the backend API (similar to OpenAI)
const formatMessagesForBackend = (messages: Message[]) => {
  return messages.map(msg => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
    // Include function_call property if this is a tool result message
    ...(msg.toolCall ? {
      tool_calls: [
        {
          id: msg.toolCall.id || `call_${Date.now()}`,
          type: 'function',
          function: {
            name: msg.toolCall.name,
            arguments: JSON.stringify(msg.toolCall.parameters)
          }
        }
      ]
    } : {}),
    // Include tool results if available
    ...(msg.toolResult ? {
      tool_call_id: msg.toolCall?.id,
      name: msg.toolCall?.name,
      content: JSON.stringify(msg.toolResult)
    } : {})
  }));
};

// Helper function to simulate streaming for the UI
const simulateStreaming = async (text: string, onChunk: (text: string) => void) => {
  const words = text.split(' ');
  let currentText = '';
  for (const word of words) {
    currentText += word + ' ';
    onChunk(currentText);
    await new Promise(resolve => setTimeout(resolve, 15)); // Small delay between words
  }
};

// Function to convert tools to Anthropic format
function convertToolsAnthropicFormat(tools: any[]) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return [];
  }

  return tools.map(tool => {
    if (tool.type === 'function' && tool.function) {
      const { name, parameters, description } = tool.function;
      
      // Format the name to ensure it only contains allowed characters
      const formattedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');

      return {
        "name": formattedName,
        "description": description,
        "input_schema": {
          "type": "object",
          "properties": parameters.properties || {},  // Preserve the original properties structure
          "required": parameters.required || []
        }
      };
    }
    return null;
  }).filter(Boolean);
}

// Function to convert tools to Gemini format
function convertToolsGeminiFormat(tools: any[]) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return [];
  }

  // Convert tools to the format Gemini expects
  const functionDeclarations = tools.map(tool => {
    if (tool.type === 'function' && tool.function) {
      const { name, parameters, description } = tool.function;
      
      // Format the name to ensure it only contains allowed characters
      const formattedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
      
      return {
        name: formattedName,
        description,
        parameters: {
          type: parameters.type,
          properties: parameters.properties || {},
          required: parameters.required || []
        }
      };
    }
    return null;
  }).filter(Boolean);

  // Return in the expected "tools" with "functionDeclarations" format
  return [
    {
      functionDeclarations
    }
  ];
}

// Function to call the backend API and get response
const callBackendAPI = async (messages: any[], tools: any[], modelName?: string, spaceId?: string, apiKey?: string) => {
  // Get the auth token from localStorage
  const authToken = localStorage.getItem('fastnAuthToken') || '';
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-fastn-space-id' : spaceId || '',
    'stage': 'LIVE',
    'x-fastn-custom-auth': "true",
    'authorization': `Bearer ${authToken}`
  };

  // Format tool names to ensure they meet API requirements 
  const formattedTools = tools.map(tool => {
    if (tool.type === 'function' && tool.function && tool.function.name) {
      return {
        ...tool,
        function: {
          ...tool.function,
          name: tool.function.name.replace(/[^a-zA-Z0-9_-]/g, '_')
        }
      };
    }
    return tool;
  });

  // Determine which tool format to use based on model name
  let processedTools = formattedTools;
  const requestBody: any = {
    input: {
      messages,
      tools: processedTools
    }
  };
  
  // Add modelName only if it's specified - correct format expected by API
  if (modelName) {
    // For the API, set the model directly in the root of input
    requestBody.input.model = modelName;
    
    // Add API key if provided
    if (apiKey) {
      requestBody.input.api_key = apiKey;
    }
    
    // Check for Anthropic models
    if (modelName.includes('claude')) {
      processedTools = convertToolsAnthropicFormat(tools);
      requestBody.input.tools = processedTools;
    } 
    // Check for Gemini models
    else if (modelName.includes('gemini')) {
      processedTools = convertToolsGeminiFormat(tools);
      // For Gemini, the format is different - tools is an array at the top level
      requestBody.input.tools = processedTools;
    }
    // For OpenAI models (gpt), use the original format
  }

  const body = JSON.stringify(requestBody);

  console.log('Sending request to LLM API:', {
    url: FASTN_API_URL,
    modelName,
    spaceId,
    bodyPreview: { ...requestBody, input: { ...requestBody.input, messages: '[redacted]' } }
  });

  const response = await fetch(FASTN_API_URL, {
    method: 'POST',
    headers,
    body
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('API Error Response:', errorData);
    throw new Error(`Backend API request failed with status ${response.status}: ${errorData}`);
  }

  const data = await response.json();
  // Assuming the backend response mirrors OpenAI structure
  return data; 
};

// Function to get streaming response using the backend API
export const getStreamingAIResponse = async (
  message: string,
  availableTools: any[],
  previousMessages: Message[],
  onChunk: (text: string) => void,
  onComplete: (response: AIResponse) => void,
  modelName?: string,
  spaceId?: string,
  apiKey?: string
) => {
  try {
    // Format previous messages for the backend
    const formattedPreviousMessages = formatMessagesForBackend(previousMessages);
    
    // Create messages array with system prompt, previous messages and current message
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...formattedPreviousMessages,
      { role: 'user' as const, content: message }
    ];

    // Call the backend API - pass spaceId and apiKey
    const backendResponse = await callBackendAPI(messages, availableTools, modelName, spaceId, apiKey);

    // Handle different response formats based on model type
    let responseText = '';
    let toolCalls = null;
    
    // Check if this is a Gemini response format
    if (backendResponse.candidates && backendResponse.modelVersion?.includes('gemini')) {
      // Gemini format
      console.log('Processing Gemini response:', backendResponse);
      const candidate = backendResponse.candidates[0];
      if (candidate?.content?.parts?.length > 0) {
        const part = candidate.content.parts[0];
        
        // Check if this is a function call or text response
        if (part.text) {
          responseText = part.text;
        } else if (part.functionCall) {
          // Handle Gemini function call format
          console.log('Detected Gemini function call:', part.functionCall);
          
          // Store as null for text since this is a function call
          responseText = '';
          
          // Create a tool call array in a format similar to OpenAI's for consistent processing
          toolCalls = [{
            id: `gemini_call_${Date.now()}`,
            type: 'function',
            function: {
              name: part.functionCall.name,
              // Convert args object to JSON string to match OpenAI format
              arguments: JSON.stringify(part.functionCall.args || {})
            }
          }];
          
          console.log('Converted Gemini function call to OpenAI format:', toolCalls);
        }
      }
    } else {
      // Assume OpenAI/default format
      responseText = backendResponse?.choices?.[0]?.message?.content || '';
      toolCalls = backendResponse?.choices?.[0]?.message?.tool_calls;
    }
    
    let actionData = null;

    if (toolCalls && toolCalls.length > 0) {
      const toolCall = toolCalls[0]; // Assuming one tool call for now
      
      if (toolCall && toolCall.function) {
        // Find the matching tool from available tools
        const matchedTool = availableTools.find(tool => 
          tool.function.name === toolCall.function.name
        );
        
        if (matchedTool) {
          // Parse the arguments JSON string
          const parameters = JSON.parse(toolCall.function.arguments || '{}');
          
          // Create an action object with the matched tool's actionId
          actionData = {
            actionId: matchedTool.actionId,
            name: toolCall.function.name,
            parameters: parameters,
            id: toolCall.id || `call_${Date.now()}`
          };
        }
      }
    }

    // Prepare the final response object
    let responseObj: AIResponse = {
      response: responseText || (actionData ? `I'll help you with ${actionData.name.replace('mcp_fastn_', '')}. Click Run Tool to proceed.` : 'Something went wrong.'),
      action: actionData
    };

    // Simulate streaming for the UI
    if (onChunk && responseObj.response) {
      await simulateStreaming(responseObj.response, onChunk);
    }
    
    // Complete the response
    onComplete(responseObj);
    return responseObj;
  } catch (error) {
    console.error('Error getting AI response from backend:', error);
    // Provide a user-friendly error message
    const errorResponse: AIResponse = {
      response: 'Sorry, I encountered an error trying to process your request.',
      action: null
    };
    if (onChunk) {
      await simulateStreaming(errorResponse.response, onChunk);
    }
    onComplete(errorResponse);
    throw error; // Re-throw for further handling if needed
  }
};

// Function to get AI response for tool execution results using the backend API
export const getToolExecutionResponse = async (
  toolName: string,
  toolResult: any,
  previousMessages: Message[],
  availableTools: any[],
  onChunk?: (text: string) => void,
  onComplete?: (response: AIResponse) => void,
  modelName?: string,
  spaceId?: string,
  apiKey?: string
): Promise<AIResponse> => {
  try {
    // Format previous messages for the backend
    const formattedPreviousMessages = formatMessagesForBackend(previousMessages);

    // Find the last tool call message to get its ID
    const lastToolCallMessage = [...previousMessages].reverse().find(msg => msg.toolCall?.name === toolName);
    const toolCallId = lastToolCallMessage?.toolCall?.id || `call_${Date.now()}`;

    // Create the tool result message
    const toolResultMessage = {
      role: 'assistant' as const,
      content: null,
      tool_calls: [{
        id: toolCallId,
        type: 'function',
        function: {
          name: toolName,
          arguments: JSON.stringify(lastToolCallMessage?.toolCall?.parameters || {})
        }
      }]
    };

    // Create the tool response message
    const toolResponseMessage = {
      role: 'tool' as const,
      tool_call_id: toolCallId,
      name: toolName,
      content: JSON.stringify(toolResult)
    };

    // Create messages array including the tool call and result
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...formattedPreviousMessages,
      toolResultMessage,
      toolResponseMessage,
      // Add a user message asking for interpretation
      { 
        role: 'user' as const, 
        content: `I've executed the "${toolName}" tool. Please interpret the results and tell me what to do next.` 
      }
    ];

    // Log conversation for debugging
    console.log('Sending conversation to LLM:', JSON.stringify(messages, null, 2));

   // Call the backend API - pass spaceId and apiKey
   const backendResponse = await callBackendAPI(messages, availableTools, modelName, spaceId, apiKey);

    // Handle error response
    if (!backendResponse || backendResponse.error) {
      console.error('Error from backend API:', backendResponse?.error || 'No response');
      throw new Error(backendResponse?.error?.message || 'Failed to get response from backend');
    }

    // Handle different response formats based on model type
    let responseText = '';
    let toolCalls = null;
    
    // Check if this is a Gemini response format
    if (backendResponse.candidates && backendResponse.modelVersion?.includes('gemini')) {
      // Gemini format
      console.log('Processing Gemini response:', backendResponse);
      const candidate = backendResponse.candidates[0];
      if (candidate?.content?.parts?.length > 0) {
        const part = candidate.content.parts[0];
        
        // Check if this is a function call or text response
        if (part.text) {
          responseText = part.text;
        } else if (part.functionCall) {
          // Handle Gemini function call format
          console.log('Detected Gemini function call:', part.functionCall);
          
          // Store as null for text since this is a function call
          responseText = '';
          
          // Create a tool call array in a format similar to OpenAI's for consistent processing
          toolCalls = [{
            id: `gemini_call_${Date.now()}`,
            type: 'function',
            function: {
              name: part.functionCall.name,
              // Convert args object to JSON string to match OpenAI format
              arguments: JSON.stringify(part.functionCall.args || {})
            }
          }];
          
          console.log('Converted Gemini function call to OpenAI format:', toolCalls);
        }
      }
    } else {
      // Assume OpenAI/default format
      responseText = backendResponse?.choices?.[0]?.message?.content || '';
      toolCalls = backendResponse?.choices?.[0]?.message?.tool_calls;
    }

    let actionData = null;
    if (toolCalls && toolCalls.length > 0) {
      const toolCall = toolCalls[0];
      if (toolCall && toolCall.function) {
        const matchedTool = availableTools.find(tool => tool.function.name === toolCall.function.name);
        if (matchedTool) {
          try {
            const parameters = JSON.parse(toolCall.function.arguments || '{}');
            actionData = {
              actionId: matchedTool.actionId,
              name: toolCall.function.name,
              parameters: parameters,
              id: toolCall.id || `call_${Date.now()}`
            };
          } catch (e) {
            console.error('Error parsing tool arguments:', e);
            // Continue without action if parsing fails
          }
        }
      }
    }

    // Prepare the final response object
    let responseObj: AIResponse = {
      response: responseText || 'Action completed.',
      action: actionData
    };

    // Simulate streaming for the UI if requested
    if (onChunk && responseObj.response) {
      await simulateStreaming(responseObj.response, onChunk);
    }

    // Complete the response if callback provided
    if (onComplete) {
      onComplete(responseObj);
    }
    
    return responseObj;
  } catch (error) {
    console.error('Error interpreting tool execution result via backend:', error);
    const errorResponse: AIResponse = {
      response: 'Sorry, I encountered an error trying to process the tool execution result.',
      action: null
    };
    if (onChunk) {
      await simulateStreaming(errorResponse.response, onChunk);
    }
    if (onComplete) {
      onComplete(errorResponse);
    }
    return errorResponse;
  }
};