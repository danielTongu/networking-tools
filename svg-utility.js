"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Utility for creating SVG elements with geometry-only parameters.
 */
class SvgUtility {
    /**
     * Create an SVG node.
     *
     * @param {string} tag - SVG tag name.
     * @returns {SVGElement} Created SVG element.
     */
    create(tag) {
        return document.createElementNS(SVG_NS, tag);
    }

    /**
     * Append a child SVG element.
     *
     * @param {SVGElement} parent - Parent SVG element.
     * @param {SVGElement} child - Child SVG element.
     * @returns {SVGElement} Appended child.
     */
    append(parent, child) {
        parent.appendChild(child);
        return child;
    }

    /**
     * Remove all SVG children.
     *
     * @param {SVGSVGElement} svg - SVG root.
     */
    clear(svg) {
        svg.replaceChildren();
    }

    /**
     * Configure the SVG viewport.
     *
     * @param {SVGSVGElement} svg - SVG root.
     * @param {number} width - Drawing width.
     * @param {number} height - Drawing height.
     */
    setViewBox(svg, width, height) {
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.setAttribute("width", String(width));
        svg.setAttribute("height", String(height));
    }

    /**
     * Draw a line.
     *
     * @param {SVGElement} parent - Parent SVG element.
     * @param {number} x1 - Start X.
     * @param {number} y1 - Start Y.
     * @param {number} x2 - End X.
     * @param {number} y2 - End Y.
     * @param {string} className - CSS class list.
     * @returns {SVGLineElement} Line element.
     */
    line(parent, x1, y1, x2, y2, className = "") {
        const node = this.create("line");

        node.setAttribute("x1", String(x1));
        node.setAttribute("y1", String(y1));
        node.setAttribute("x2", String(x2));
        node.setAttribute("y2", String(y2));

        if (className) {
            node.setAttribute("class", className);
        }

        return this.append(parent, node);
    }

    /**
     * Draw a rectangle.
     *
     * @param {SVGElement} parent - Parent SVG element.
     * @param {number} x - X position.
     * @param {number} y - Y position.
     * @param {number} width - Rectangle width.
     * @param {number} height - Rectangle height.
     * @param {string} className - CSS class list.
     * @returns {SVGRectElement} Rectangle element.
     */
    rect(parent, x, y, width, height, className = "") {
        const node = this.create("rect");

        node.setAttribute("x", String(x));
        node.setAttribute("y", String(y));
        node.setAttribute("width", String(width));
        node.setAttribute("height", String(height));

        if (className) {
            node.setAttribute("class", className);
        }

        return this.append(parent, node);
    }

    /**
     * Draw a circle.
     *
     * @param {SVGElement} parent - Parent SVG element.
     * @param {number} cx - Center X.
     * @param {number} cy - Center Y.
     * @param {number} radius - Circle radius.
     * @param {string} className - CSS class list.
     * @returns {SVGCircleElement} Circle element.
     */
    circle(parent, cx, cy, radius, className = "") {
        const node = this.create("circle");

        node.setAttribute("cx", String(cx));
        node.setAttribute("cy", String(cy));
        node.setAttribute("r", String(radius));

        if (className) {
            node.setAttribute("class", className);
        }

        return this.append(parent, node);
    }

    /**
     * Draw a path.
     *
     * @param {SVGElement} parent - Parent SVG element.
     * @param {string} d - SVG path data.
     * @param {string} className - CSS class list.
     * @returns {SVGPathElement} Path element.
     */
    path(parent, d, className = "") {
        const node = this.create("path");

        node.setAttribute("d", d);

        if (className) {
            node.setAttribute("class", className);
        }

        return this.append(parent, node);
    }

    /**
     * Draw text.
     *
     * @param {SVGElement} parent - Parent SVG element.
     * @param {string} content - Text content.
     * @param {number} x - X position.
     * @param {number} y - Y position.
     * @param {string} className - CSS class list.
     * @returns {SVGTextElement} Text element.
     */
    text(parent, content, x, y, className = "") {
        const node = this.create("text");

        node.setAttribute("x", String(x));
        node.setAttribute("y", String(y));
        node.textContent = content;

        if (className) {
            node.setAttribute("class", className);
        }

        return this.append(parent, node);
    }

    /**
     * Create an SVG group.
     *
     * @param {SVGElement} parent - Parent SVG element.
     * @param {string} className - CSS class list.
     * @returns {SVGGElement} Group element.
     */
    group(parent, className = "") {
        const node = this.create("g");

        if (className) {
            node.setAttribute("class", className);
        }

        return this.append(parent, node);
    }
}

const Svg = Object.freeze(new SvgUtility());

export default Svg;