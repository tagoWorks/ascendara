import React from "react";

export const CloseCircleXIcon = ({
  fill = 'none',
  size,
  height,
  width,
  stroke = 'currentColor',
  strokeWidth = 32,
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
      <path
        d="M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192 192-86 192-192z"
        fill="none"
        stroke={stroke}
        strokeMiterlimit="10"
        strokeWidth={strokeWidth}
      />
      <path
        d="M320 320L192 192M192 320l128-128"
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
};
