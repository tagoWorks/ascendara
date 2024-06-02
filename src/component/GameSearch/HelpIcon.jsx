import React from "react";

export const HelpIcon = ({
  fill = 'none',
  stroke = 'currentColor',
  size,
  height,
  width,
  ...props
}) => {
  return (
    <svg
      width={size || width || '24px'}
      height={size || height || '24px'}
      viewBox="0 0 512 512"
      fill={fill}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M256 80a176 176 0 10176 176A176 176 0 00256 80z" fill={fill} stroke={stroke} strokeMiterlimit="10" strokeWidth="32"/>
      <path d="M200 202.29s.84-17.5 19.57-32.57C230.68 160.77 244 158.18 256 158c10.93-.14 20.69 1.67 26.53 4.45 10 4.76 29.47 16.38 29.47 41.09 0 26-17 37.81-36.37 50.8S251 281.43 251 296" fill={fill} stroke={stroke} strokeLinecap="round" strokeMiterlimit="10" strokeWidth="28"/>
      <circle cx="250" cy="348" r="20" fill={stroke}/>
    </svg>
  );
};
