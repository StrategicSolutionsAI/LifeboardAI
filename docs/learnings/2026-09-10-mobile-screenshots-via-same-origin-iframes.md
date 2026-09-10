# Mobile/tablet screenshots when the browser window will not resize

**Problem** — `resize_window` (Claude-in-Chrome) reported "Successfully resized to 390x844" but every screenshot stayed 1772 px wide; `innerWidth` never changed (the Chrome window is fullscreen on this Mac), so the mandatory mobile pass looked blocked.

**Approach**
1. Confirmed the failure with `javascript_tool` (`[innerWidth, innerHeight]`) instead of trusting the tool's success message.
2. Checked whether the app allows same-origin framing: `grep frame-ancestors src/utils/supabase/middleware.ts` → `'self'`, and `next.config.js` sets `X-Frame-Options: SAMEORIGIN`. Same-origin iframes are therefore permitted and carry the session cookie.
3. Replaced the current tab's `document.body` with `<iframe>` elements sized 390×844 (phone) and 820×900 (tablet, the md–lg band) pointing at `/dashboard`, `/calendar`, `/tasks`; waited ~7 s; screenshot. Media queries evaluate against the iframe width, so the real mobile layout renders.
4. Clicked inside a frame (bottom-nav "More") with normal coordinates — real DOM clicks work through the frame.
5. Measured instead of eyeballing: in the top page or a frame's `contentDocument`, `main.scrollHeight - main.clientHeight` gives how far a page overflows the shell; `getBoundingClientRect()` on the page root exposes collapsed (0 px) children.

**Solution** — No code change; a review technique. Harness snippet:
```js
document.body.innerHTML=''; document.body.style.cssText='margin:0;display:flex;gap:24px;padding:16px;background:#888';
const mk=(src,w,h)=>{const f=document.createElement('iframe');f.src=src;f.style.cssText=`width:${w}px;height:${h}px;border:0;flex:none`;document.body.appendChild(f)};
mk('/dashboard',390,844); mk('/calendar',820,900);
```

**Rule** — When a viewport-changing tool claims success, verify with `innerWidth` before believing the screenshot. If the window cannot change, render the route inside same-origin iframes of the target width (check `frame-ancestors`/`X-Frame-Options` first) and screenshot those; measure overflow with `scrollHeight` and `getBoundingClientRect` rather than judging by eye.

**Dead ends**
- Re-issuing `resize_window` with different dimensions or order (width-then-height): still no-op.
- Assuming the auth wall blocks review: the user's Chrome already holds a live `localhost:3000` session, so authenticated pages render directly.
