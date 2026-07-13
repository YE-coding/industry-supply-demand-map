export async function loadMarkdownText(path) {
  const response = await fetch(path, { headers: { Accept: 'text/markdown, text/plain' } });
  if (!response.ok) throw new Error('原始 Markdown 暂时无法载入。');
  return response.text();
}
