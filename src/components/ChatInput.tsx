import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import TextareaAutosize from "react-textarea-autosize";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  className?: string;
  authStatus: string;
}

export interface ChatInputHandles {
  resetMessage: () => void;
}

export const ChatInput = forwardRef<ChatInputHandles, ChatInputProps>(({ onSendMessage, disabled, className, authStatus }, ref) => {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Expose resetMessage function to parent component
  useImperativeHandle(ref, () => ({
    resetMessage: () => {
      setMessage('');
    }
  }));
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      setIsSubmitting(true);
      onSendMessage(message.trim());
      setMessage('');
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !disabled && message.trim()) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`flex gap-2 w-full ${className || ''}`}>
      <div className="flex items-center bg-[#F6F6FE] rounded-[6px] w-full">
        <div className="relative flex-1">
          {disabled && authStatus !== 'success' &&(
            <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 hover:opacity-100">
              <div className="bg-black text-white text-xs py-1 px-2 rounded shadow-lg">
                Login to send messages
              </div>
            </div>
          )}
          <TextareaAutosize
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            readOnly={disabled}
            className={`flex-1 bg-transparent text-[14px] border-none rounded-[10px] text-sm px-[16px] py-[10px] focus:ring-0 focus:outline-none resize-none w-full ${
              disabled
                ? "text-gray-600 placeholder:text-gray-400 cursor-not-allowed"
                : "text-gray-800 placeholder:text-[#94A3B8]"
            } max-h-20`}
            placeholder={"Tell me to send you a Slack message for example"}
            minRows={1}
            maxRows={4}
          />
        </div>
        <button
          disabled={isSubmitting || !message.trim() || disabled}
          type="submit"
          className={`p-2 text-[#5B5EF0] disabled:text-gray-400 mr-2 relative group ${
            isSubmitting || !message.trim() || disabled ? "cursor-default" : "cursor-pointer"
          }`}
        >
          {isSubmitting ? (
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
});