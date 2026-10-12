export function presentationUrl(source) {
  const url = new URL(source);
  for (const key of ['receiver', 'postMessageEvents', 'notes']) url.searchParams.delete(key);
  url.searchParams.set('presentation', '1');
  url.hash = '';
  return url.href;
}
