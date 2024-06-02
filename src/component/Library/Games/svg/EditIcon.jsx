import React from "react";

export const EditIcon = ({
  fill = 'currentColor',
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
        strokeWidth="44" 
        d="M358.62 129.28L86.49 402.08 70 442l39.92-16.49 272.8-272.13-24.1-24.1zM413.07 74.84l-11.79 11.78 24.1 24.1 11.79-11.79a16.51 16.51 0 000-23.34l-.75-.75a16.51 16.51 0 00-23.35 0z"
      />
    </svg>
  );
};
