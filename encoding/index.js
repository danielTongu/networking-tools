"use strict";

import Svg from "../svg-utility.js";

/**
 * Encodes bit strings into line-code signal levels.
 */
class Encoder {
    static FOUR_B_FIVE_B = Object.freeze({
        "0000": "11110",
        "0001": "01001",
        "0010": "10100",
        "0011": "10101",
        "0100": "01010",
        "0101": "01011",
        "0110": "01110",
        "0111": "01111",
        "1000": "10010",
        "1001": "10011",
        "1010": "10110",
        "1011": "10111",
        "1100": "11010",
        "1101": "11011",
        "1110": "11100",
        "1111": "11101"
    });

    /**
     * Remove non-binary characters.
     *
     * @param {string} raw - Raw user input.
     * @returns {string} Binary-only string.
     */
    static cleanBits(raw) {
        return String(raw).replace(/[^01]/g, "");
    }

    /**
     * Encode bits as NRZ levels.
     *
     * @param {string} bits - Binary input.
     * @returns {number[]} Signal levels.
     */
    static nrz(bits) {
        const levels = [];

        for (const bit of bits) {
            levels.push(bit === "1" ? 1 : 0);
        }

        return levels;
    }

    /**
     * Encode bits as NRZI levels.
     *
     * @param {string} bits - Binary input.
     * @param {number} startLevel - Initial level.
     * @returns {number[]} Signal levels.
     */
    static nrzi(bits, startLevel) {
        let level = startLevel;
        const levels = [];

        for (const bit of bits) {
            if (bit === "1") {
                level = level === 1 ? 0 : 1;
            }

            levels.push(level);
        }

        return levels;
    }

    /**
     * Encode bits as Manchester half-bit levels.
     *
     * @param {string} bits - Binary input.
     * @returns {number[]} Half-bit signal levels.
     */
    static manchester(bits) {
        const levels = [];

        for (const bit of bits) {
            if (bit === "0") {
                levels.push(1, 0);
            } else {
                levels.push(0, 1);
            }
        }

        return levels;
    }

    /**
     * Encode bits using 4B/5B.
     *
     * @param {string} bits - Binary input.
     * @returns {string} Encoded bit string.
     */
    static fourBFiveB(bits) {
        let padded = bits;
        let encoded = "";

        while (padded.length % 4 !== 0) {
            padded += "0";
        }

        for (let index = 0; index < padded.length; index += 4) {
            encoded += Encoder.FOUR_B_FIVE_B[padded.slice(index, index + 4)];
        }

        return encoded;
    }
}

/**
 * Draws the horizontally scrollable encoding waveform.
 */
class EncodingDiagram {
    /**
     * Create the diagram renderer.
     *
     * @param {SVGSVGElement} svg - SVG drawing surface.
     */
    constructor(svg) {
        this.svg = svg;
        this.layout = {};
        this.readLayout();
    }

    /**
     * Read numeric diagram variables from CSS.
     */
    readLayout() {
        const style = getComputedStyle(this.svg);

        this.layout = {
            height: this.readCssNumber(style, "--diagram-height", 340),
            leftMargin: this.readCssNumber(style, "--scroll-left-space", 0),
            rightMargin: this.readCssNumber(style, "--diagram-right-margin", 60),
            bitWidth: this.readCssNumber(style, "--diagram-bit-width", 70),

            bitSequenceY: this.readCssNumber(style, "--bit-sequence-y", 70),

            signalHighY: this.readCssNumber(style, "--signal-high-y", 110),
            signalLowY: this.readCssNumber(style, "--signal-low-y", 155),

            clockHighY: this.readCssNumber(style, "--clock-high-y", 210),
            clockLowY: this.readCssNumber(style, "--clock-low-y", 255),

            bitPeriodNumberY: this.readCssNumber(style, "--bit-period-number-y", 328),
            gridTopY: this.readCssNumber(style, "--grid-top-y", 0),
            gridBottomY: this.readCssNumber(style, "--grid-bottom-y", 340),

            transitionRadius: this.readCssNumber(style, "--transition-radius", 5)
        };
    }

    /**
     * Parse a CSS numeric custom property.
     *
     * @param {CSSStyleDeclaration} style - Computed style.
     * @param {string} name - CSS custom property name.
     * @param {number} fallback - Default value.
     * @returns {number} Parsed number.
     */
    readCssNumber(style, name, fallback) {
        const value = parseFloat(style.getPropertyValue(name));

        return Number.isFinite(value) ? value : fallback;
    }

    /**
     * Draw the full diagram.
     *
     * @param {string} bits - Displayed bit sequence.
     * @param {number[]} levels - Signal levels.
     * @param {boolean} halfBit - Whether levels use half-bit units.
     */
    draw(bits, levels, halfBit) {
        this.readLayout();

        const bitCount = bits.length;
        const width = this.getDiagramWidth(bitCount);

        Svg.clear(this.svg);
        Svg.setViewBox(this.svg, width, this.layout.height);

        this.drawBackground(width);
        this.drawBitPeriodLines(bitCount);
        this.drawHalfBitLines(bitCount);
        this.drawReferenceLines(bitCount);
        this.drawBitSequence(bits);
        this.drawSignal(levels, halfBit);
        this.drawClock(bitCount);
        this.drawBitPeriodNumbers(bitCount);
    }

    /**
     * Get total SVG width.
     *
     * @param {number} bitCount - Number of bit periods.
     * @returns {number} Diagram width.
     */
    getDiagramWidth(bitCount) {
        return this.layout.leftMargin + bitCount * this.layout.bitWidth + this.layout.rightMargin;
    }

    /**
     * Draw the diagram background.
     *
     * @param {number} width - SVG width.
     */
    drawBackground(width) {
        Svg.rect(this.svg, 0, 0, width, this.layout.height, "diagram-background");
    }

    /**
     * Draw full-height bit-period lines.
     *
     * @param {number} bitCount - Number of bit periods.
     */
    drawBitPeriodLines(bitCount) {
        for (let index = 0; index <= bitCount; index++) {
            const x = this.layout.leftMargin + index * this.layout.bitWidth;

            Svg.line(
                this.svg,
                x,
                this.layout.gridTopY,
                x,
                this.layout.gridBottomY,
                "bit-period-line"
            );
        }
    }

    /**
     * Draw full-height half-bit subdivision lines.
     *
     * @param {number} bitCount - Number of bit periods.
     */
    drawHalfBitLines(bitCount) {
        for (let index = 0; index < bitCount; index++) {
            const x = this.layout.leftMargin + index * this.layout.bitWidth + this.layout.bitWidth / 2;

            Svg.line(
                this.svg,
                x,
                this.layout.gridTopY,
                x,
                this.layout.gridBottomY,
                "half-bit-line"
            );
        }
    }

    /**
     * Draw voltage reference lines.
     *
     * @param {number} bitCount - Number of bit periods.
     */
    drawReferenceLines(bitCount) {
        const startX = this.layout.leftMargin;
        const endX = this.layout.leftMargin + bitCount * this.layout.bitWidth;
        const middleY = (this.layout.signalHighY + this.layout.signalLowY) / 2;

        Svg.line(this.svg, startX, this.layout.signalHighY, endX, this.layout.signalHighY, "high-5v-line");
        Svg.line(this.svg, startX, this.layout.signalLowY, endX, this.layout.signalLowY, "low-0v-line");
        Svg.line(this.svg, startX, middleY, endX, middleY, "mid-voltage-line");
    }

    /**
     * Draw bit sequence values.
     *
     * @param {string} bits - Bit sequence.
     */
    drawBitSequence(bits) {
        const group = Svg.group(this.svg, "bit-sequence-group");

        for (let index = 0; index < bits.length; index++) {
            const x = this.layout.leftMargin + index * this.layout.bitWidth + this.layout.bitWidth / 2;

            Svg.text(
                group,
                bits[index],
                x,
                this.layout.bitSequenceY,
                "bit-sequence-bit anchor-middle"
            );
        }
    }

    /**
     * Draw signal waveform.
     *
     * @param {number[]} levels - Signal levels.
     * @param {boolean} halfBit - Whether to draw half-bit intervals.
     */
    drawSignal(levels, halfBit) {
        const group = Svg.group(this.svg, "data-signal-group");

        if (levels.length > 0) {
            const unit = halfBit ? this.layout.bitWidth / 2 : this.layout.bitWidth;
            const path = this.createSignalPath(levels, unit);

            Svg.path(group, path, "data-signal-line");
            this.drawTransitionMarkers(group, levels, unit);
        }
    }

    /**
     * Build a stepped signal path.
     *
     * @param {number[]} levels - Signal levels.
     * @param {number} unit - Horizontal unit width.
     * @returns {string} SVG path data.
     */
    createSignalPath(levels, unit) {
        let previousY = this.getSignalY(levels[0]);
        let path = `M ${this.layout.leftMargin} ${previousY}`;

        for (let index = 1; index < levels.length; index++) {
            const x = this.layout.leftMargin + index * unit;
            const y = this.getSignalY(levels[index]);

            path += ` L ${x} ${previousY}`;

            if (y !== previousY) {
                path += ` L ${x} ${y}`;
            }

            previousY = y;
        }

        path += ` L ${this.layout.leftMargin + levels.length * unit} ${previousY}`;

        return path;
    }

    /**
     * Convert a signal level into a Y coordinate.
     *
     * @param {number} level - Signal level.
     * @returns {number} Y coordinate.
     */
    getSignalY(level) {
        return level === 1 ? this.layout.signalHighY : this.layout.signalLowY;
    }

    /**
     * Draw transition markers on the signal.
     *
     * @param {SVGGElement} group - Signal group.
     * @param {number[]} levels - Signal levels.
     * @param {number} unit - Horizontal unit width.
     */
    drawTransitionMarkers(group, levels, unit) {
        for (let index = 1; index < levels.length; index++) {
            if (levels[index] !== levels[index - 1]) {
                const x = this.layout.leftMargin + index * unit;
                const y = this.getSignalY(levels[index]);

                Svg.circle(group, x, y, this.layout.transitionRadius, "data-signal-transition");
            }
        }
    }

    /**
     * Draw clock waveform.
     *
     * @param {number} bitCount - Number of bit periods.
     */
    drawClock(bitCount) {
        const group = Svg.group(this.svg, "clock-group");

        for (let index = 0; index < bitCount; index++) {
            this.drawClockPeriod(group, index);
        }
    }

    /**
     * Draw one clock period.
     *
     * @param {SVGGElement} group - Clock group.
     * @param {number} index - Bit-period index.
     */
    drawClockPeriod(group, index) {
        const x = this.layout.leftMargin + index * this.layout.bitWidth;
        const middleX = x + this.layout.bitWidth / 2;
        const endX = x + this.layout.bitWidth;
        const clockPeriodX = x + this.layout.bitWidth / 2;

        Svg.line(group, x, this.layout.clockLowY, x, this.layout.clockHighY, "clock-line");
        Svg.line(group, x, this.layout.clockHighY, middleX, this.layout.clockHighY, "clock-line");
        Svg.line(group, middleX, this.layout.clockHighY, middleX, this.layout.clockLowY, "clock-line");
        Svg.line(group, middleX, this.layout.clockLowY, endX, this.layout.clockLowY, "clock-line");
        Svg.text(group, "T", clockPeriodX, this.layout.clockLowY - 9, "clock-period-label anchor-middle");
    }

    /**
     * Draw bit-period numbers.
     *
     * @param {number} bitCount - Number of bit periods.
     */
    drawBitPeriodNumbers(bitCount) {
        const group = Svg.group(this.svg, "bit-period-number-group");

        for (let index = 0; index < bitCount; index++) {
            const x = this.layout.leftMargin + index * this.layout.bitWidth + this.layout.bitWidth / 2;

            Svg.text(
                group,
                String(index + 1),
                x,
                this.layout.bitPeriodNumberY,
                "bit-period-number anchor-middle"
            );
        }
    }
}

/**
 * Main app controller.
 */
export default class EncodingApp {
    /**
     * Initialize the app.
     */
    constructor() {
        this.elements = this.getElements();
        this.diagram = new EncodingDiagram(this.elements.diagram);
        this.bindEvents();
        this.draw();
    }

    /**
     * Get page elements.
     *
     * @returns {Object} Page elements.
     */
    getElements() {
        return {
            bits: document.getElementById("bits"),
            encoding: document.getElementById("encoding-select"),
            startLevel: document.getElementById("start-level"),
            outputText: document.getElementById("output-text"),
            diagram: document.getElementById("encoding-diagram"),
            title: document.getElementById("encoding-title")
        };
    }

    /**
     * Bind input events.
     */
    bindEvents() {
        this.elements.bits.addEventListener("input", () => this.draw());
        this.elements.encoding.addEventListener("change", () => this.draw());
        this.elements.startLevel.addEventListener("change", () => this.draw());
    }

    /**
     * Draw the current encoding.
     */
    draw() {
        const rawBits = Encoder.cleanBits(this.elements.bits.value);
        const startLevel = this.elements.startLevel.value === "high" ? 1 : 0;
        const encoding = this.elements.encoding.value;
        const result = this.encode(rawBits, startLevel, encoding);

        this.diagram.draw(result.diagramBits, result.levels, result.halfBit);
        this.elements.outputText.textContent = this.getOutputText(rawBits, result);

        if (this.elements.title) {
            this.elements.title.textContent = `${result.label} Encoding Diagram`;
        }
    }

    /**
     * Encode bits based on the selected encoding.
     *
     * @param {string} rawBits - Clean input bits.
     * @param {number} startLevel - Initial signal level.
     * @param {string} encoding - Encoding key.
     * @returns {Object} Encoding result.
     */
    encode(rawBits, startLevel, encoding) {
        const result = {
            diagramBits: rawBits,
            levels: [],
            label: "",
            halfBit: false,
            note: ""
        };

        switch (encoding) {
            case "nrz":
                result.levels = Encoder.nrz(rawBits);
                result.label = "NRZ";
                break;

            case "nrzi":
                result.levels = Encoder.nrzi(rawBits, startLevel);
                result.label = "NRZI";
                break;

            case "manchester":
                result.levels = Encoder.manchester(rawBits);
                result.label = "Manchester";
                result.halfBit = true;
                break;

            case "four-b-five-b":
                result.diagramBits = Encoder.fourBFiveB(rawBits);
                result.levels = Encoder.nrzi(result.diagramBits, startLevel);
                result.label = "4B/5B + NRZI";
                result.note = `4B/5B: ${rawBits} --> ${result.diagramBits}`;
                break;

            default:
                result.levels = Encoder.nrz(rawBits);
                result.label = "NRZ";
                break;
        }

        return result;
    }

    /**
     * Build the status text.
     *
     * @param {string} rawBits - Clean input bits.
     * @param {Object} result - Encoding result.
     * @returns {string} Status text.
     */
    getOutputText(rawBits, result) {
        let text = `Input: ${rawBits} (${rawBits.length} bits)`;

        if (result.note) {
            text = `${result.note}`;
        }

        if (result.halfBit) {
            text += " | Half-bit intervals shown";
        }

        return text;
    }
}

document.addEventListener("DOMContentLoaded", function initializeApplication() {
    new EncodingApp();
});
