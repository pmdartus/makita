## Web page test runs

Standard - https://www.webpagetest.org/lighthouse.php?test=230302_BiDc9V_4JE&run=1#Performance
No script - https://www.webpagetest.org/lighthouse.php?test=230302_BiDcBZ_4KZ&run=1

Blocked URL:
- https://www.takima.fr\/main.c0a87d2d5163a74e365b.js
- https://www.takima.fr\/runtime.ef8a4255c24cff458c28.js
- https://www.takima.fr\/polyfills.395e9be537673f728fc2.js

## Links

- https://www.debugbear.com/blog/devtools-performance
- https://www.youtube.com/watch?v=5eQUx00jffg
- https://www.builder.io/blog/monomorphic-javascript
- https://twitter.com/mhevery/status/1631129022175256576

## Steps

### Local repro

Setup localhost reproduction by copying over all the requests requests. I have done it manually for this case since there is only a handful of them. That said there is certainly a better approach using HAR file recording or a proxy like Burpsuite.

Based on the HTTP responses, all the assets from `takima.fr` are served using Express. So I created a new Express server to serve the static content I collected.

### Enable H2

When running a local performance analysis, page is even slower to load (TODO: Find my how much). It's because Node.js is serving traffic over HTTP/1.1. 

H1 uses a different connection (socket) for each request. By default, Node.js responds with `keep-alive` header, which means that the client can reuse the same connection for subsequent requests (for a specific time frame, by default 5 sec). To avoid overloading servers, browsers limits the numbers of open connections to a single domain to 6 (only apply to browsers!). The 7th request will be queued until the first one gets completed.

> Speak about network contentions and the bars next to the network requests. 

H2 doesn't suffer from this issue, since all the requests are pipelined over a single TCP connection. Even if number of opened connections is not a problem in H2, we still constrained by network bandwidth and lantency.

There are many tutorials for using Node.js to server traffic over H2. That said all of them are quite painful to configure. H2 specification supports plain and encrypted communication, similar to H1. However browsers (for good reasons) only implements H2 over TLS, and it causes all sorts of issues when using this locally. 

Instead of serving H2 directly from Node.js, I will use a reverse proxy locally. In this case I used [Caddy](https://caddyserver.com/). It's like Nginx but simpler and better packaged.

> Show [Caddy](https://caddyserver.com/) website.

Now that the environments are similar, let's looks at the initial page load! Now it's time to optimize.

### Optimization 1 - Compress assets over the wire

It appears that all the resources are loading in an extremely slow fashion (even when fast 3G is enabled). Why?

> Show the different colors on the HTTP traffic. 
> Look at the Network tab at the bottom and show that `Resource size` and `Transfer size` are quite similar. (Resource: 4MB, Transfered: 3.9MB)

Solution for this enable GZIP. Again it's possible to do this at Node.js layer, that said it's far from being ideal. It's definitely something worth delegating to the reverse proxy. By default Caddy [encode](https://caddyserver.com/docs/caddyfile/directives/encode) is configured as such:

```
match {
    header Content-Type text/*
    header Content-Type application/json*
    header Content-Type application/javascript*
    header Content-Type application/xhtml+xml*
    header Content-Type application/atom+xml*
    header Content-Type application/rss+xml*
    header Content-Type image/svg+xml*
}
```

Where are the image and fonts files in there? Let's add them.

```
encode gzip {
    match {
        header Content-Type text/*
        header Content-Type application/json*
        header Content-Type application/javascript*
        header Content-Type image/*
        header Content-Type font/*
    }
}
```

There is little value in using gzip or br over images since those a binary files in compressed format. In fact this can degrade performance.

After those changes we are now at 1.9MB transferred size, which is a 50% reduction overall. 

### Optimization 2 - Rehydration removal

There is a couple of issues with the current SSR approach.

When looking at the film strip we can see that the application gets blanked and in the middle of the loading. What is going on? Originally thought it was something specific to Angular router, hiding content until rehydration is done using a CSS class. That said it's not the case, the entire application gets effectively unmounted and remounted. 

> Search of `"app-contact"` and add breakpoint in the `ngOnInit`. And look at the tree, it is really different.

Let's look at the requests following the rehydration, 1 catches my attention:
- https://makita.localhost/assets/Paint/Text-underline/Yellow1@2x.png

Looking at the film strip, there is a rehydration issue where the color of the underline changes.

Solution let's disable JavaScript for now.

> Open `postuler-vite` and show the network trace.

### Optimization 3 - Fix asset preload issue

One thing the site does well, it is that it preloads the font files necessary for the page. This avoids network waterfall for page critical assets that aren't directly discoverable by the HTML scanner / pre-loader. 

That said looking at the network traffic in the timeline, we are seeing a lot of fonts getting downloaded. Why? Because the URL doesn't match:
- https://makita.localhost/assets/font/HVD%20Fonts%20-%20BrandonGrotesque-Bold.otf
- https://makita.localhost/HVD%20Fonts%20-%20BrandonGrotesque-Bold.645d96f9d734d763912c.otf

Result:
- Preload isn't wasting bandwidth anymore
- 5 less request that is part of the critical path

> Open `postuler-plus-vite` and show the network trace.

### Optimization 4 - Optimize image loading

- Remove light paper background from preload. It's way below the fold.
- Optimize image, it is currently 66KB which is a lot for a background. Keep in mind that above ~10KB it would require multiple server roundtrips to load an HTTP response (problem with latency). Since the image is loaded via CSS, there is no straight forward way to do graceful degradation. Using MozJPEG for this as it is backward compatible with all browsers. Release by Mozilla in 2014 ([post](https://research.mozilla.org/2014/03/05/introducing-the-mozjpeg-project/)). Original file size: 66KB -> 12KB (5x reduction).
- While we are at it let's optimize the rest of the images present on the page.

> Show https://squoosh.app/editor
> Open `postuler-toujours-plus-vite`

### Optimization 5 - Remove material icon usage

- Require 2 round trips to retrieve the font for material icon:
    - https://fonts.googleapis.com/icon?family=Material+Icons -> minimal request to set font-face
    - https://fonts.gstatic.com/s/materialicons/v139/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2
- On top of this, requires opening 2 new secure connections to new hosts.
- It appears that Angular SSR does a good job of lazy loading main stylesheet using the `onload` trick

```html
<link
    rel="stylesheet"
    href="styles.5720f2108a8a4f4dad7e-img-optimized.css"
    media="print"
    onload="this.media='all'"
/>
```

- Link stylesheet is parser blocking, meaning that it blocks the rest of the page from getting parsed by the browser and rendered on the screen. The Angular SSR trick of lazy loading the main stylesheet for first initial render is diminished by this. 
- Inlining directly the icon in the generated HTML.

> Open `postuler-toujours-toujours-plus-vite`