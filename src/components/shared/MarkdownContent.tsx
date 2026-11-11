import { Content } from '@patternfly/react-core';
import type { FC } from 'react';
import { renderMarkdown } from '../../utils/markdown';

interface MarkdownContentProps {
  text: string;
}

export const MarkdownContent: FC<MarkdownContentProps> = ({ text }) => {
  const html = renderMarkdown(text);
  return <Content dangerouslySetInnerHTML={{ __html: html }} />;
};
