import React from "react";
import classNames from "classnames";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "outline" | "filled" | "text";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "filled",
  className = "",
  onClick,
  disabled = false,
  ...props
}) => {
  const baseStyles = "rounded-md transition-colors focus:outline-none";
  
  const variantStyles = {
    filled: "bg-blue-500 text-white hover:bg-blue-600",
    outline: "border border-gray-300 bg-white hover:bg-gray-50",
    text: "hover:bg-gray-100"
  };

  return (
    <button
      type="button"
      className={classNames(
        baseStyles,
        variantStyles[variant],
        className
      )}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}; 