import axios from 'axios';
import { Tool } from './types';

const api = axios.create({
  baseURL: 'https://live.fastn.ai',
  headers: {
    'Content-Type': 'application/json',
    'x-fastn-space-tenantid': '',
    'stage': 'LIVE',
    'x-fastn-custom-auth': 'true',
  },
});

export const getTools = async (useCase: string, apiKey: string, spaceId: string): Promise<Tool[]> => {
  if (!apiKey || !spaceId) {
    console.warn('API Key or Space ID is missing. Cannot fetch tools.');
    return [];
  }
  try {
    const response = await api.post('/api/mcp/getTools', {
      input: {
        useCase,
        spaceId: spaceId,
      },
    }, {
      headers: {
        'x-fastn-api-key': apiKey,
        'x-fastn-space-id': spaceId,
      }
    });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching tools:', error);
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new Error('Invalid API Key or Space ID. Please check your credentials.');
    }
    throw error;
  }
};

const getFlowNameFromFunctionName = (functionName: string): string => {
  const parts = functionName.split('_');
  if (parts.length >= 3 && parts[0] === 'mcp' && parts[1] === 'fastn') {
    return parts.slice(2).join('_');
  }
  return functionName;
};

const inferActionId = (parameters: any, tools: Tool[]): string | null => {
  if (parameters.body?.title || parameters.body?.properties?.title) {
    if (parameters.body?.title) {
      const docTool = tools.find(tool =>
        tool.function.name === 'mcp_fastn_createDocument' ||
        tool.function.description.includes('Google Docs')
      );
      return docTool?.actionId || null;
    }
    if (parameters.body?.properties?.title) {
      const sheetTool = tools.find(tool =>
        tool.function.name === 'mcp_fastn_createSpreadsheet' ||
        tool.function.description.includes('Google Sheet')
      );
      return sheetTool?.actionId || null;
    }
  }
  if (parameters.body?.raw) {
    const emailTool = tools.find(tool =>
      tool.function.name === 'mcp_fastn_sendMail' ||
      tool.function.description.includes('Gmail')
    );
    return emailTool?.actionId || null;
  }
  return null;
};

export const executeTool = async (
  actionId: string | null,
  parameters: Record<string, any>,
  apiKey: string,
  spaceId: string,
  availableTools: Tool[]
) => {
  if (!apiKey || !spaceId) {
    throw new Error('API Key or Space ID is missing. Cannot execute tool.');
  }
  try {
    let tool = availableTools.find(t => t.actionId === actionId);
    
    if (!tool && !actionId) {
      const inferredActionId = inferActionId(parameters, availableTools);
      if (inferredActionId) {
        tool = availableTools.find(t => t.actionId === inferredActionId);
      }
    }
    
    if (!tool) {
      console.error("Available tools for inference:", availableTools);
      console.error("Parameters for inference:", parameters);
      throw new Error('Unable to determine which tool to execute. Invalid or missing actionId.');
    }
    
    const toolActionId = tool.actionId;
    
    const response = await api.post(`/api/mcp/executeTool`, {
      input: {
        actionId: toolActionId,
        parameters: parameters
      }
    }, {
      headers: {
        'x-fastn-api-key': apiKey,
        'x-fastn-space-id': spaceId,
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error executing tool:', error);
    
    if (axios.isAxiosError(error) && (error.response?.status === 429 || error.response?.status === 503)) {
      console.log("Tool execution failed with a transient error, retrying once...");
      try {
        const retryTool = availableTools.find(t => t.actionId === actionId);
        if (!retryTool) {
          throw new Error('Tool not found for retry');
        }
        
        const retryResponse = await api.post(`/api/mcp/executeTool`, {
          input: {
            actionId: retryTool.actionId,
            parameters: parameters
          }
        }, {
          headers: {
            'x-fastn-api-key': apiKey,
            'x-fastn-space-id': spaceId,
          }
        });
        
        return retryResponse.data;
      } catch (retryError) {
        console.error('Error executing retry:', retryError);
        throw retryError;
      }
    }
    
    if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('Invalid API Key or Space ID. Failed to execute tool.');
    }
    throw error;
  }
};