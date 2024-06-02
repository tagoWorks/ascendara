import React from "react";

export const StopIcon = ({
  fill = 'none',
  size,
  height,
  width,
  ...props
}) => {
  return (
    <svg
      width={size || width || 24}
      height={size || height || 24}
      viewBox="0 0 512 512"
      fill={fill === 'none' ? 'none' : fill}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path 
        fill="none" 
        stroke={fill} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth="32" 
        d="M80 320V144a32 32 0 0132-32h0a32 32 0 0132 32v112M144 256V80a32 32 0 0132-32h0a32 32 0 0132 32v160M272 241V96a32 32 0 0132-32h0a32 32 0 0132 32v224M208 240V48a32 32 0 0132-32h0a32 32 0 0132 32v192" 
      />
      <path 
        fill="none" 
        stroke={fill} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth="32" 
        d="M80 320c0 117.4 64 176 152 176s123.71-39.6 144-88l52.71-144c6.66-18.05 3.64-34.79-11.87-43.6h0c-15.52-8.82-35.91-4.28-44.31 11.68L336 320" 
      />
    </svg>
  );
};
