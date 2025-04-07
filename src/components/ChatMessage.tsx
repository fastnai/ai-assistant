import React, { useState } from 'react';
import { Message } from '../types';
import { PlayCircle, ChevronDown, ChevronUp, Check } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  onExecuteTool?: (actionData: any) => void;
  isLoading?: boolean;
  toolResults?: any;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  onExecuteTool, 
  isLoading = false,
  toolResults
}) => {
  const isUser = message.role === 'user';
  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  
  // Format JSON for display with proper syntax highlighting
  const formatJson = (json: any) => {
    try {
      return JSON.stringify(json, null, 2);
    } catch (e) {
      return typeof json === 'string' ? json : 'Invalid JSON';
    }
  };
  
  // Extract tool ID from actionId
  const getToolId = (actionId: string) => {
    if (!actionId) return '';
    const parts = actionId.split('_');
    return parts.length > 1 ? parts[parts.length - 1] : actionId;
  };

  // Determine if we should show the Run Tool button
  const showRunToolButton = !isUser && message.hasAction && message.actionData && !toolResults;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`rounded-lg px-4 py-3 max-w-[90%] ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-800'
        } ${message.isStreaming ? 'border-l-4 border-green-500 animate-pulse' : ''}
        ${message.isToolExecution ? 'border border-gray-300 bg-gray-50 italic' : ''}
        ${showRunToolButton ? 'border-2 border-green-400' : ''}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-medium ${isUser ? 'text-blue-100' : 'text-gray-600'}`}>
            {isUser ? 'You' : 'Assistant'}
          </span>
          <span className={`text-xs ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          {message.isStreaming && (
            <span className="text-xs text-green-600 font-medium">
              Typing...
            </span>
          )}
        </div>

        <div className="whitespace-pre-wrap">{message.content}</div>
        
        {/* Run Tool button when action is available */}
        {showRunToolButton && (
          <div className="mt-3 py-2 border-t border-green-300">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-green-700">Ready to Execute</span>
              <button
                onClick={() => onExecuteTool && onExecuteTool(message.actionData)}
                disabled={isLoading}
                className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-md"
              >
                <PlayCircle className="w-4 h-4" />
                Run Tool
              </button>
            </div>
          </div>
        )}
        
        {/* Collapsible Tool Parameters */}
        {!isUser && message.hasAction && message.actionData && (
          <div className="mt-3 border-t border-gray-200 pt-2">
            <div 
              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-blue-600" 
              onClick={() => setIsParamsOpen(!isParamsOpen)}
            >
              {isParamsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <span className="font-medium">
                Tool: {getToolId(message.actionData.actionId)}
              </span>
              {message.actionData?.name && (
                <span className="text-blue-600">{message.actionData.name.replace('mcp_fastn_', '')}</span>
              )}
            </div>
            
            {isParamsOpen && (
              <div className="mt-2 pl-6">
                <p className="text-sm font-medium text-gray-700 mb-1">Parameters:</p>
                <pre className="bg-gray-900 text-green-400 p-3 rounded-md text-xs overflow-x-auto">
                  {formatJson(message.actionData.parameters)}
                </pre>
              </div>
            )}
            
            {/* Show tool execution results if available */}
            {toolResults && (
              <>
                <div 
                  className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-blue-600 mt-2" 
                  onClick={() => setIsResultsOpen(!isResultsOpen)}
                >
                  {isResultsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  <span className="font-medium">Result</span>
                  <Check size={16} className="text-green-500" />
                </div>
                
                {isResultsOpen && (
                  <div className="mt-2 pl-6">
                    <pre className="bg-gray-900 text-green-400 p-3 rounded-md text-xs overflow-x-auto">
                      {formatJson(toolResults)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};