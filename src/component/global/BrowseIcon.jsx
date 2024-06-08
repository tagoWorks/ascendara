import React from "react";

export const BrowseIcon = ({
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
      fill={fill}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M256 80a176 176 0 10176 176A176 176 0 00256 80z" fill="none" stroke="currentColor" strokeWidth="32"/>
      <path d="M232 160a72 72 0 1072 72 72 72 0 00-72-72z" fill="none" stroke="currentColor" strokeMiterlimit="10" strokeWidth="32"/>
      <path fill="none" stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="32" d="M283.64 283.64L336 336"/>
    </svg>
  );
};
