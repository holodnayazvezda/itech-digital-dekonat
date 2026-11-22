import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
const markdownPlugins = [remarkGfm];
const markdownComponents = {
  a: ({
    href,
    children
  }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
  img: ({
    alt
  }) => alt ? <span>{alt}</span> : null,
  table: ({
    children
  }) => <div className="irishka-table" role="region" aria-label="Таблица в ответе" tabIndex={0}><table>{children}</table></div>,
  h1: ({
    children
  }) => <h3>{children}</h3>,
  h2: ({
    children
  }) => <h3>{children}</h3>
};
export default memo(function ReplyMarkdown({
  text
}) {
  return <div className="irishka-message-text irishka-markdown">
    <Markdown skipHtml remarkPlugins={markdownPlugins} components={markdownComponents} urlTransform={url => /^https?:\/\//i.test(url) ? url : ""}>{text}</Markdown>
  </div>;
});
