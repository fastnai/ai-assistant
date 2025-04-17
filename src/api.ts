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

// Update axios request config to include the latest headers before each request
api.interceptors.request.use(config => {
  // Get the auth token from localStorage for each request
  const authToken = localStorage.getItem('fastnAuthToken');
  if (authToken) {
    config.headers['authorization'] = `Bearer ${authToken}`;
  }
  return config;
});

// New function to check if connectors are available
export const getConnectors = async (spaceId: string, tenantId: string): Promise<boolean> => {
  if (!spaceId || !tenantId) {
    console.warn('Space ID or Tenant ID is missing. Cannot fetch connectors.');
    return false;
  }
  
  try {
    const response = await api.post('/api/graphql', {
      query: `query connectors($input: GetConnectorsListInput!) {
        connectors(input: $input) {
          id
        }
      }`,
      variables: {
        input: {
          projectId: spaceId,
          tenantId: tenantId,
          onlyActive: true,
          environment: "DRAFT"
        }
      }
    }, {
      headers: {
        'x-fastn-space-id': spaceId,
        'x-fastn-space-tenantid': tenantId,
        'custom-auth': 'true'
      }
    });
    
    // Check if connectors data exists and is not empty
    const connectorsData = response.data?.data?.connectors;
    const hasConnectors = Array.isArray(connectorsData) && connectorsData.length > 0;
    
    if (!hasConnectors) {
      console.log('No apps available - connectors data is empty or null');
    }
    
    return hasConnectors;
  } catch (error) {
    console.error('Error fetching connectors:', error);
    return false;
  }
};

export const getTools = async (useCase: string, apiKey: string, spaceId: string, tenantId?: string): Promise<Tool[]> => {
  if (!apiKey || !spaceId) {
    console.warn('API Key or Space ID is missing. Cannot fetch tools.');
    return [];
  }
  try {
    const response = await api.post('/api/ucl/getTools', {
      input: {
        useCase,
        spaceId: spaceId,
      },
    }, {
      headers: {
        // 'x-fastn-api-key': apiKey,
        'x-fastn-space-id': spaceId,
        'x-fastn-space-tenantid': tenantId || '',
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
  availableTools: Tool[],
  tenantId?: string
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
    
    // Prepare headers with optional tenant ID
    const headers: Record<string, string> = {
      // 'x-fastn-api-key': apiKey,
      'x-fastn-space-id': spaceId,
      'x-fastn-space-tenantid': tenantId || '',
    };
    

    
    const response = await api.post(`/api/ucl/executeTool`, {
      input: {
        actionId: toolActionId,
        parameters: parameters
      }
    }, {
      headers
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
        
        // Prepare headers with optional tenant ID for retry
        const headers: Record<string, string> = {
          // 'x-fastn-api-key': apiKey,
          'x-fastn-space-id': spaceId,
         'x-fastn-space-tenantid' :tenantId ||''
        };
        
        // Add tenant ID to headers if provided
        // if (tenantId) {
        //   headers['x-fastn-space-tenantid'] = tenantId;
        // }
        
        const retryResponse = await api.post(`/api/ucl/executeTool`, {
          input: {
            actionId: retryTool.actionId,
            parameters: parameters
          }
        }, {
          headers
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