import { NextResponse } from 'next/server'

// Self-contained so showing an outage never invokes another auth-dependent route.
export function authUnavailableResponse(): NextResponse {
  return new NextResponse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Temporarily unavailable | Lifeboard</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
      background: #fcfaf8; color: #314158; font-family: system-ui, sans-serif; }
    main { width: 100%; max-width: 460px; padding: 32px; border: 1px solid #ddd6cf;
      border-radius: 16px; background: white; }
    h1 { margin: 0 0 16px; font-size: 26px; line-height: 1.25; }
    p { color: #596881; line-height: 1.6; }
    nav { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-top: 24px; }
    a { color: #314158; text-underline-offset: 4px; }
    .retry { display: inline-block; padding: 12px 20px; border-radius: 8px;
      background: #314158; color: white; text-decoration: none; }
    a:focus-visible { outline: 3px solid #b1916a; outline-offset: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>We can’t connect right now</h1>
    <p>Lifeboard’s sign-in service is temporarily unavailable. Please try again in a moment.</p>
    <nav aria-label="Recovery options"><a class="retry" href="">Try again</a><a href="/">Go to homepage</a></nav>
  </main>
</body>
</html>`, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Retry-After': '5',
    },
  })
}
