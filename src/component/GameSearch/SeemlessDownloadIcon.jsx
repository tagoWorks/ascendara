import React from "react";
import { Spacer } from "@nextui-org/react";


export const SeemlessDownloadIcon = ({
  fill = 'currentColor',
  size,
  height,
  width,
  ...props
}) => {
  return (
    <>
    <svg
      width={size || width || 24}
      height={size || height || 24}
      viewBox="0 0 512 512"
      fill={fill === 'none' ? 'none' : fill}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path 
        d="M481.29 229.47l-188.87-113a30.54 30.54 0 00-31.09-.39 33.74 33.74 0 00-16.76 29.47v79.05L63.85 116.44a30.54 30.54 0 00-31.09-.39A33.74 33.74 0 0016 145.52v221A33.74 33.74 0 0032.76 396a30.54 30.54 0 0031.09-.39L244.57 287.4v79.08A33.74 33.74 0 00261.33 396a30.54 30.54 0 0031.09-.39l188.87-113a31.27 31.27 0 000-53z"
        fill={fill}
      />
    </svg>
    </>
  );
};
