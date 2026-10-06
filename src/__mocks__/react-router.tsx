import * as React from 'react';

export const Link: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <a href={to}>{children}</a>
);

export const useNavigate = jest.fn(() => jest.fn());
