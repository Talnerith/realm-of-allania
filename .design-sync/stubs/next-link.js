// Design-sync stand-in for 'next/link': a plain anchor outside Next.js
export default function Link({ href, children, prefetch: _prefetch, ...rest }) {
  return <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>;
}
