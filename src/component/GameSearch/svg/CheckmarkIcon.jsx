import React from "react";
import { Tooltip } from "@nextui-org/react";

export const CheckmarkIcon = ({
  fill = 'none',
  size,
  height,
  width,
  stroke = '#87CEEB',
  strokeWidth = 128,
  ...props
}) => {
  return (
    <Tooltip content="Trusted by others on Ascendara">
    <svg
      width={size || width || 24}
      height={size || height || 24}
      viewBox="0 0 512 512"
      fill={fill}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M416 128L192 384l-96-96"
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </svg>
    </Tooltip>
  );
};
