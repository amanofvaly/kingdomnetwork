# Automatic link previews

Express injects page-specific Open Graph and Twitter metadata into the initial
HTML for public `/churches/:slug`, `/courses/:slug`, `/listing/:slug`,
`/materials/:slug`, and enabled `/give/:slug` pages. Legacy resource links redirect
to materials. Normal copied URLs work; no special sharing URL is required.

## Rendering and storage

`/api/og/:type/:slug.png?v=<revision>` returns a 1200 × 630 PNG. Satori lays out
content with bundled Geist WOFF files, and Sharp processes artwork and renders
PNG output. Types use the same names as the page routes. Artwork is optional;
missing or failed images produce a text-based card. The existing browser-generated
downloadable QR cards remain independent.

The resolver checks publication, demo visibility, the publishing church, and
public media before serving previews, including cached requests. Missing pages
return 404 with generic unavailable metadata; missing image requests return a
404 branded image. No individual credential, private download, or account data
is included.

There is one replaceable JSON cache entry per page under the configured upload
storage's `og/` directory. Its image is base64 encoded. This directory is not
served directly through the public media route. Cache entries expire after six
hours, allowing failed remote artwork to recover. Relevant content, church,
local image revisions, and the template version determine the image URL revision.
Increment `template` in `server/lib/og/content.js` when changing card layouts.
Concurrent requests for the same revision share generation. HTTP responses
revalidate so that a revoked page is checked before cached bytes or a 304 is sent.
External platforms may retain previews already attached to messages.

Remote artwork is HTTPS only, limited to 8 MiB and five seconds including
redirects, with a maximum of three redirects. Each destination's DNS addresses
must be public, and the chosen address is pinned to the socket. Local media
requires an image asset with public visibility. Decoder input is limited to
25 million pixels. Failures fall back without breaking page navigation.

## Verification and deployment

Run `npx vitest run server/__tests__/og.test.js` and the normal client build.
The HTTP test starts an ephemeral loopback server. Tests cover real Express
responses, metadata escaping, visibility, conditional requests, caching,
redirect safety, PNG dimensions, and long-title layout bounds.

Deploy the normal Node application with production dependencies and a freshly
built `client/dist`. No database migration or new environment variable is needed.
`PUBLIC_BASE_URL` must be the public HTTPS origin (already required in production).
Sharp's supported platform binaries must be installed on the deployment target.

Vite's development server serves its own static HTML. To inspect server-injected
metadata locally, build the client and use the Express port, not Vite's port.

After deployment, fetch a public page without JavaScript and verify that its
`og:image` URL returns `image/png` anonymously. Check one URL of each page type
with the relevant platform's preview debugger, and confirm images at thumbnail
size. This requires public reachability; local tests cannot verify third-party
preview caching or unfurl behavior. `[og]` warnings identify lookup, render, or
cache-write failures in the existing server logs.
