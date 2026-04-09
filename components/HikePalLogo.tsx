import React from 'react';

interface HikePalLogoProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

const HikePalLogo: React.FC<HikePalLogoProps> = ({
  className = '',
  size = 24,
  strokeWidth = 2.75,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 28 24"
    fill="none"
    width={size}
    height={size}
    className={className}
    aria-hidden="true"
  >
    <path
      d="M4 20 9.6 6.4 14.2 13.4 19.8 4 24 20H4Z"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default HikePalLogo;
