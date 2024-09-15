import React from "react";
import { Tooltip } from "@nextui-org/react";

export const FlameIcon = ({
  fill1 = '#D3560F',
  fill2 = '#FF7C1E',
  size,
  height,
  width,
  ...props
}) => {
  return (
    <Tooltip delay={750} content="This game is pretty popular right now">
    <svg
      width={size || width || 144}
      height={size || height || 234}
      viewBox="0 0 144 234"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M0 152.75C0 100.801 62 60.582 48 0.8125C81 0.8125 144 54.4375 144 152.75C144 174.083 136.414 194.543 122.912 209.628C109.409 224.713 91.0956 233.188 72 233.188C52.9044 233.188 34.5909 224.713 21.0883 209.628C7.58569 194.543 0 174.083 0 152.75Z"
        fill={fill1}
      />
      <path
        d="M104 179.562C104 211.799 88 224.25 72 224.25C56 224.25 40 211.799 40 179.562C40 147.326 60 131.523 56 108.062C77 108.062 104 147.326 104 179.562Z"
        fill={fill2}
      />
    </svg>
    </Tooltip>
  );
};
