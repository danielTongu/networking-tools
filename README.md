# Networking Tools

Interactive networking simulators and calculators for studying and teaching computer networking concepts.

**Live Site:** https://danielTongu.github.io/networking-tools/

## Features

### Sliding Window Protocol Simulator
- Visualize frame transmission and acknowledgements.
- Simulate retransmissions and timeout behavior.
- Explore Go-Back-N and Selective Repeat ARQ.
- Observe duplicate ACK and SACK operation.

### Encoding Diagram Generator
- Generate digital waveform diagrams for:
    - NRZ
    - NRZI
    - Manchester
    - 4B/5B + NRZI
- Interactive SVG-based visualization.

### Network Transfer Time Calculator
- Calculate:
    - Propagation delay
    - Transmission delay
    - Round-trip time (RTT)
    - Multi-hop switch delay
    - End-to-end file transfer time
- Generate topology diagrams and step-by-step calculation worksheets.

## Technologies

- HTML5
- CSS3 (Grid, Flexbox, Custom Properties)
- Modern JavaScript (ES Modules)
- SVG graphics
- GitHub Pages

## Running Locally

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/networking-tools.git
cd networking-tools
```

You can open `index.html` directly in a browser, or start a simple local server:

```bash
python -m http.server 8000
```

Then navigate to:

```
http://localhost:8000/
```

## Project Structure

```text
networking-tools/
├── index.html
├── index.css
├── global.css
├── footer.js
├── svg-utility.js
├── sliding-window/
├── encoding/
├── transfer-time/
├── robots.txt
├── sitemap.xml
├── google[...].html # Google Search Console verification file
├── LICENSE
└── README.md
```

## Search Engine Support

The project includes:
- Semantic HTML structure
- Canonical URLs
- Open Graph metadata
- `robots.txt`
- `sitemap.xml`

After deployment, submit the sitemap to Google Search Console:

```
https://danielTongu.github.io/networking-tools/sitemap.xml
```

## License

Copyright © 2026 Daniel T. All rights reserved.

This repository and its contents are provided for viewing and educational reference only. No part of this project may be copied, modified, redistributed, published, sublicensed, or incorporated into other works without prior written permission from the copyright holder.