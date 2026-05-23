import React from 'react';

export function RaisedHandIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="14" cy="6" r="3" />
      <path d="M14 9v8" />
      <path d="M14 10L8 4" />
      <path d="M14 10l4 4" />
      <path d="M14 17l-3 5" />
      <path d="M14 17l3 5" />
    </svg>
  );
}
