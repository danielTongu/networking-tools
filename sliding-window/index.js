"use strict";

import Svg from "../svg-utility.js";

/**
 * Represents one frame transmission.
 */
class FrameBehavior {
    /**
     * Create a frame event.
     *
     * @param {number} seqNum - Frame sequence number.
     * @param {number} sendTime - Send time in RTT units.
     * @param {boolean} isRetransmission - Whether frame is retransmitted.
     */
    constructor(seqNum, sendTime, isRetransmission = false) {
        this.seqNum = seqNum;
        this.sendTime = sendTime;
        this.receiveTime = sendTime + 0.5;
        this.ackArrivalTime = sendTime + 1;
        this.lost = false;
        this.retransmitted = isRetransmission;
        this.retransmitCount = 0;
    }

    /**
     * Mark frame as lost.
     */
    markLost() {
        this.lost = true;
    }
}

/**
 * Represents a timeout event.
 */
class Timeout {
    /**
     * Create a timeout event.
     *
     * @param {number} timeoutTime - Timeout time.
     * @param {number} frameNum - Timed-out frame number.
     * @param {number} retransmitCount - Retransmission count.
     */
    constructor(timeoutTime, frameNum, retransmitCount) {
        this.timeoutTime = timeoutTime;
        this.frameNum = frameNum;
        this.retransmitCount = retransmitCount;
    }
}

/**
 * Represents an acknowledgement event.
 */
class AckEvent {
    /**
     * Create an ACK event.
     *
     * @param {number} ackNum - ACK number.
     * @param {boolean} isDuplicate - Whether ACK is duplicate.
     * @param {number} receiveTime - Receiver send time.
     * @param {number} ackArrivalTime - Sender arrival time.
     * @param {number} sourceFrame - Source frame number.
     * @param {Array} sackBlocks - SACK blocks.
     */
    constructor(ackNum, isDuplicate, receiveTime, ackArrivalTime, sourceFrame, sackBlocks = []) {
        this.ackNum = ackNum;
        this.isDuplicate = isDuplicate;
        this.receiveTime = receiveTime;
        this.ackArrivalTime = ackArrivalTime;
        this.sourceFrame = sourceFrame;
        this.applied = false;
        this.sackBlocks = sackBlocks;
    }

    /**
     * Get visualization type.
     *
     * @returns {string} ACK type.
     */
    getType() {
        let type = "ack";

        if (this.isDuplicate) {
            type = "duplicate-ack";
        } else if (this.sackBlocks.length > 0) {
            type = "sack";
        }

        return type;
    }
}

/**
 * Sender-side sliding-window model.
 */
class Sender {
    /**
     * Create sender.
     *
     * @param {Object} settings - Simulation settings.
     */
    constructor(settings) {
        this.settings = settings;
        this.base = settings.firstFrame;
        this.nextSeq = settings.firstFrame;
        this.failedFrames = new Set(settings.failedFrames);
        this.outstanding = new Map();
        this.dupAckCount = new Map();
        this.fastRetransmitPending = false;
        this.fastRetransmitFrame = null;
    }

    /**
     * Check whether sender can send a new frame.
     *
     * @returns {boolean} True when send is allowed.
     */
    canSendNewFrame() {
        const windowEnd = this.base + this.settings.sws - 1;

        return this.nextSeq <= this.settings.targetFrame &&
            this.nextSeq <= windowEnd &&
            this.outstanding.size < this.settings.sws &&
            !this.fastRetransmitPending;
    }

    /**
     * Send a new frame.
     *
     * @param {number} sendTime - Send time.
     * @returns {FrameBehavior|null} Frame or null.
     */
    sendNewFrame(sendTime) {
        let frame = null;

        if (this.canSendNewFrame()) {
            frame = new FrameBehavior(this.nextSeq, sendTime, false);

            if (this.failedFrames.has(frame.seqNum)) {
                frame.markLost();
                this.failedFrames.delete(frame.seqNum);
            }

            this.outstanding.set(frame.seqNum, frame);
            this.nextSeq++;
        }

        return frame;
    }

    /**
     * Receive ACK and update sender state.
     *
     * @param {number} ackNum - ACK number.
     * @param {boolean} isDuplicate - Whether ACK is duplicate.
     * @param {Array} sackBlocks - SACK blocks.
     */
    receiveAck(ackNum, isDuplicate, sackBlocks = []) {
        if (isDuplicate && this.outstanding.has(ackNum + 1)) {
            this.handleDuplicateAck(ackNum + 1);
        } else {
            this.handleCumulativeAck(ackNum);
            this.handleSackBlocks(sackBlocks);
        }
    }

    /**
     * Handle duplicate ACK.
     *
     * @param {number} frameNum - Missing frame number.
     */
    handleDuplicateAck(frameNum) {
        const count = (this.dupAckCount.get(frameNum) || 0) + 1;

        this.dupAckCount.set(frameNum, count);

        if (count >= 3 && !this.fastRetransmitPending) {
            this.triggerFastRetransmit(frameNum);
        }
    }

    /**
     * Handle cumulative ACK.
     *
     * @param {number} ackNum - ACK number.
     */
    handleCumulativeAck(ackNum) {
        if (ackNum >= this.base) {
            for (let seq = this.base; seq <= ackNum; seq++) {
                this.outstanding.delete(seq);
                this.dupAckCount.delete(seq);
            }

            this.base = ackNum + 1;

            if (this.fastRetransmitPending && ackNum >= this.fastRetransmitFrame) {
                this.fastRetransmitPending = false;
                this.fastRetransmitFrame = null;
            }
        }
    }

    /**
     * Handle SACK blocks.
     *
     * @param {Array} sackBlocks - SACK blocks.
     */
    handleSackBlocks(sackBlocks) {
        for (const block of sackBlocks) {
            for (let seq = block.start; seq <= block.end; seq++) {
                this.outstanding.delete(seq);
                this.dupAckCount.delete(seq);
            }
        }
    }

    /**
     * Trigger fast retransmit.
     *
     * @param {number} frameNum - Frame to retransmit.
     */
    triggerFastRetransmit(frameNum) {
        const frame = this.outstanding.get(frameNum);

        if (frame && !frame.retransmitted) {
            this.fastRetransmitPending = true;
            this.fastRetransmitFrame = frameNum;
        }
    }

    /**
     * Perform fast retransmit.
     *
     * @param {number} currentTime - Current time.
     * @returns {FrameBehavior|null} Retransmitted frame.
     */
    fastRetransmit(currentTime) {
        let retransmitFrame = null;

        if (this.fastRetransmitPending && this.outstanding.has(this.fastRetransmitFrame)) {
            const originalFrame = this.outstanding.get(this.fastRetransmitFrame);

            retransmitFrame = new FrameBehavior(this.fastRetransmitFrame, currentTime, true);
            retransmitFrame.retransmitCount = originalFrame.retransmitCount + 1;

            this.outstanding.set(this.fastRetransmitFrame, retransmitFrame);
        }

        this.fastRetransmitPending = false;

        return retransmitFrame;
    }

    /**
     * Get timeout time for oldest outstanding frame.
     *
     * @returns {number} Timeout time.
     */
    getTimeoutTime() {
        let timeoutTime = Infinity;
        const oldestFrame = this.getOldestOutstandingFrame();

        if (oldestFrame) {
            timeoutTime = oldestFrame.sendTime +
                this.settings.timeoutRtt * Math.pow(2, oldestFrame.retransmitCount);
        }

        return timeoutTime;
    }

    /**
     * Get oldest outstanding frame.
     *
     * @returns {FrameBehavior|null} Oldest outstanding frame.
     */
    getOldestOutstandingFrame() {
        let oldestSeq = Infinity;
        let oldestFrame = null;

        for (const [seq, frame] of this.outstanding) {
            if (seq < oldestSeq) {
                oldestSeq = seq;
                oldestFrame = frame;
            }
        }

        return oldestFrame;
    }

    /**
     * Handle timeout.
     *
     * @param {number} currentTime - Current time.
     * @returns {FrameBehavior|null} Retransmitted frame.
     */
    handleTimeout(currentTime) {
        let retransmitFrame = null;
        const oldestFrame = this.getOldestOutstandingFrame();

        if (oldestFrame) {
            retransmitFrame = new FrameBehavior(oldestFrame.seqNum, currentTime, true);
            retransmitFrame.retransmitCount = oldestFrame.retransmitCount + 1;

            this.outstanding.set(oldestFrame.seqNum, retransmitFrame);
            this.dupAckCount.delete(oldestFrame.seqNum);
        }

        return retransmitFrame;
    }

    /**
     * Get next frame to send.
     *
     * @param {number} currentTime - Current time.
     * @returns {FrameBehavior|null} Frame.
     */
    getNextFrameToSend(currentTime) {
        let frame = null;

        if (this.fastRetransmitPending) {
            frame = this.fastRetransmit(currentTime);
        } else if (this.canSendNewFrame()) {
            frame = this.sendNewFrame(currentTime);
        }

        return frame;
    }

    /**
     * Check completion.
     *
     * @returns {boolean} True when done.
     */
    isComplete() {
        return this.base > this.settings.targetFrame && this.outstanding.size === 0;
    }
}

/**
 * Receiver-side sliding-window model.
 */
class Receiver {
    /**
     * Create receiver.
     *
     * @param {Object} settings - Simulation settings.
     */
    constructor(settings) {
        this.settings = settings;
        this.expected = settings.firstFrame;
        this.sackBuffer = new Set();
        this.lastAckSent = settings.firstFrame - 1;
        this.dupAckCount = 0;
    }

    /**
     * Receive frame.
     *
     * @param {FrameBehavior} frame - Frame.
     * @returns {AckEvent} ACK event.
     */
    receiveFrame(frame) {
        const seqNum = frame.seqNum;
        const windowEnd = this.expected + this.settings.rws - 1;

        if (!frame.lost && seqNum >= this.expected && seqNum <= windowEnd) {
            this.sackBuffer.add(seqNum);

            while (this.sackBuffer.has(this.expected)) {
                this.expected++;
            }
        }

        const ackNum = this.expected - 1;
        const isDuplicate = ackNum === this.lastAckSent;
        const sackBlocks = this.buildSackBlocks();

        if (isDuplicate) {
            this.dupAckCount++;
        } else {
            this.dupAckCount = 0;
        }

        this.lastAckSent = ackNum;

        return new AckEvent(ackNum, isDuplicate, frame.receiveTime, frame.ackArrivalTime, frame.seqNum, sackBlocks);
    }

    /**
     * Build SACK blocks.
     *
     * @returns {Array} SACK block list.
     */
    buildSackBlocks() {
        const blocks = [];
        const sortedFrames = Array.from(this.sackBuffer).sort(function compareNumbers(a, b) {
            return a - b;
        });

        let blockStart = null;
        let blockEnd = null;

        for (const seq of sortedFrames) {
            if (seq >= this.expected) {
                if (blockStart === null) {
                    blockStart = seq;
                    blockEnd = seq;
                } else if (seq === blockEnd + 1) {
                    blockEnd = seq;
                } else {
                    blocks.push({ start: blockStart, end: blockEnd });
                    blockStart = seq;
                    blockEnd = seq;
                }
            }
        }

        if (blockStart !== null) {
            blocks.push({ start: blockStart, end: blockEnd });
        }

        return blocks;
    }
}

/**
 * Builds the protocol event timeline.
 */
class TimelineBuilder {
    /**
     * Create timeline builder.
     *
     * @param {Object} settings - Simulation settings.
     */
    constructor(settings) {
        this.settings = settings;
        this.sender = new Sender(settings);
        this.receiver = new Receiver(settings);
        this.events = [];
        this.pendingAcks = [];
        this.currentTime = 0;
    }

    /**
     * Build event timeline.
     *
     * @returns {Array} Timeline events.
     */
    build() {
        this.currentTime = 0;
        this.sendInitialBurst();

        while (!this.sender.isComplete() && this.currentTime < 500) {
            this.advanceSimulation();
        }

        return this.events;
    }

    /**
     * Advance one simulation event.
     */
    advanceSimulation() {
        const nextAck = this.getNextAck();
        const ackTime = nextAck ? nextAck.ackArrivalTime : Infinity;
        const timeoutTime = this.sender.getTimeoutTime();
        const nextTime = Math.min(ackTime, timeoutTime);

        if (nextTime === Infinity) {
            this.currentTime = 500;
        } else {
            this.currentTime = nextTime;

            if (timeoutTime <= ackTime && timeoutTime !== Infinity) {
                this.handleTimeout();
            } else if (nextAck) {
                this.handleAck(nextAck);
            }
        }
    }

    /**
     * Send initial burst.
     */
    sendInitialBurst() {
        const tickSize = 1 / this.settings.sws;

        for (let index = 0; index < this.settings.sws; index++) {
            const frame = this.sender.sendNewFrame(this.currentTime + index * tickSize);

            if (frame) {
                this.addFrame(frame);
            }
        }
    }

    /**
     * Handle timeout.
     */
    handleTimeout() {
        const retransmitFrame = this.sender.handleTimeout(this.currentTime);

        if (retransmitFrame) {
            this.events.push({
                type: "timeout",
                data: new Timeout(this.currentTime, retransmitFrame.seqNum, retransmitFrame.retransmitCount)
            });

            this.addFrame(retransmitFrame);
        }

        this.sendAvailableFrames();
    }

    /**
     * Handle ACK arrival.
     *
     * @param {AckEvent} ack - ACK event.
     */
    handleAck(ack) {
        ack.applied = true;
        this.sender.receiveAck(ack.ackNum, ack.isDuplicate, ack.sackBlocks);
        this.sendAvailableFrames();
    }

    /**
     * Send available frames.
     */
    sendAvailableFrames() {
        const tickSize = 1 / this.settings.sws;
        let tickIndex = 0;
        let canContinue = true;

        while (tickIndex < this.settings.sws && canContinue) {
            const frame = this.sender.getNextFrameToSend(
                this.currentTime + tickIndex * tickSize
            );

            if (frame) {
                this.addFrame(frame);
                tickIndex++;
            } else {
                canContinue = false;
            }
        }
    }

    /**
     * Add frame and generated ACK.
     *
     * @param {FrameBehavior} frame - Frame.
     */
    addFrame(frame) {
        this.events.push({
            type: "frame",
            data: frame
        });

        if (!frame.lost) {
            const ack = this.receiver.receiveFrame(frame);

            this.pendingAcks.push(ack);
            this.events.push({
                type: ack.getType(),
                data: ack
            });
        }
    }

    /**
     * Get next unapplied ACK.
     *
     * @returns {AckEvent|null} Next ACK.
     */
    getNextAck() {
        this.pendingAcks.sort(function compareAckTimes(a, b) {
            return a.ackArrivalTime - b.ackArrivalTime;
        });

        return this.pendingAcks.find(function findUnappliedAck(ack) {
            return !ack.applied;
        }) || null;
    }
}


/**
 * Main sliding-window simulator.
 */
export default class SlidingWindowApp {
    static DIAGRAM_SETTINGS = Object.freeze({
        width: 920,
        minimumHeight: 820,

        axis: Object.freeze({
            gapMinRatio: 0.24,
            gapMaxRatio: 0.7,
            overhang: 40,
            labelOffsetY: -30,
            arrowSize: 11
        }),

        spacing: Object.freeze({
            min: 56,
            max: 120
        }),

        playback: Object.freeze({
            minSpeed: 0,
            maxSpeed: 1800
        }),

        arrow: Object.freeze({
            length: 10,
            width: 7
        }),

        timeGuide: Object.freeze({
            labelGap: 5,
            exteriorDashWidth: 32,
            interiorDashCount: 3,
            interiorDashRatio: 0.18,
            tickWidth: 20
        }),

        eventLabel: Object.freeze({
            width: 96,
            height: 19,
            offset: 80
        }),

        lostFrameRatio: 0.57,
        timeoutWidth: 60
    });

    /**
     * Initialize simulator.
     */
    constructor() {
        this.elements = this.getElements();
        this.settings = null;
        this.layout = null;
        this.events = [];
        this.stepIndex = 0;
        this.timer = null;

        this.configureControls();
        this.bindEvents();
        this.applySimulation();
    }

    /**
     * Get page elements.
     *
     * @returns {Object} Page elements.
     */
    getElements() {
        return {
            sws: document.getElementById("sws"),
            rws: document.getElementById("rws"),
            firstFrame: document.getElementById("first-frame"),
            targetFrame: document.getElementById("target-frame"),
            lostFrames: document.getElementById("lost-frames"),
            timeoutRtt: document.getElementById("timeout-rtt"),

            axisGap: document.getElementById("axis-gap"),
            axisGapValue: document.getElementById("axis-gap-value"),
            spacing: document.getElementById("spacing"),
            spacingValue: document.getElementById("spacing-value"),
            speed: document.getElementById("speed"),
            speedValue: document.getElementById("speed-value"),

            prevButton: document.getElementById("prev-btn"),
            nextButton: document.getElementById("next-btn"),
            runButton: document.getElementById("run-btn"),
            pauseButton: document.getElementById("pause-btn"),
            resetButton: document.getElementById("reset-btn"),
            downloadButton: document.getElementById("download-btn"),

            statusPill: document.getElementById("status-pill"),
            diagram: document.getElementById("sliding-diagram")
        };
    }

    /**
     * Configure UI control limits from centralized diagram settings.
     */
    configureControls() {
        const settings = SlidingWindowApp.DIAGRAM_SETTINGS;
        const minAxisGap = Math.round(settings.width * settings.axis.gapMinRatio);
        const maxAxisGap = Math.round(settings.width * settings.axis.gapMaxRatio);

        this.elements.axisGap.min = String(minAxisGap);
        this.elements.axisGap.max = String(maxAxisGap);
        this.elements.axisGap.value = String(maxAxisGap);

        this.elements.spacing.min = String(settings.spacing.min);
        this.elements.spacing.max = String(settings.spacing.max);
        this.elements.spacing.value = String(settings.spacing.min);

        this.elements.speed.min = String(settings.playback.minSpeed);
        this.elements.speed.max = String(settings.playback.maxSpeed);
    }

    /**
     * Bind UI events by responsibility.
     */
    bindEvents() {
        this.bindSimulationInput(this.elements.sws);
        this.bindSimulationInput(this.elements.rws);
        this.bindSimulationInput(this.elements.firstFrame);
        this.bindSimulationInput(this.elements.targetFrame);
        this.bindSimulationInput(this.elements.lostFrames);
        this.bindSimulationInput(this.elements.timeoutRtt);

        this.bindLayoutInput(this.elements.axisGap);
        this.bindLayoutInput(this.elements.spacing);

        this.elements.speed.addEventListener("input", this.applyPlayback.bind(this));

        this.elements.prevButton.addEventListener("click", this.stepBackward.bind(this));
        this.elements.nextButton.addEventListener("click", this.stepForward.bind(this));
        this.elements.runButton.addEventListener("click", this.run.bind(this));
        this.elements.pauseButton.addEventListener("click", this.stop.bind(this));
        this.elements.resetButton.addEventListener("click", this.reset.bind(this));
        this.elements.downloadButton.addEventListener("click", this.downloadSvg.bind(this));
    }

    /**
     * Bind a control that changes the simulation model.
     *
     * @param {HTMLElement} input - Input element.
     */
    bindSimulationInput(input) {
        input.addEventListener("input", this.applySimulation.bind(this));
        input.addEventListener("change", this.applySimulation.bind(this));
    }

    /**
     * Bind a control that only changes diagram layout.
     *
     * @param {HTMLElement} input - Input element.
     */
    bindLayoutInput(input) {
        input.addEventListener("input", this.applyLayout.bind(this));
        input.addEventListener("change", this.applyLayout.bind(this));
    }

    /**
     * Rebuild simulation timeline.
     */
    applySimulation() {
        this.stop();
        this.settings = this.readControls();
        this.events = new TimelineBuilder(this.settings).build();
        this.stepIndex = 0;
        this.render();
    }

    /**
     * Redraw current step without rebuilding timeline.
     */
    applyLayout() {
        this.settings = this.readControls();
        this.render();
    }

    /**
     * Apply playback-only control changes.
     */
    applyPlayback() {
        this.settings = this.readControls();
        this.updateDashboardValues();
        this.syncUi();
    }

    /**
     * Read all UI controls.
     *
     * @returns {Object} Current simulator settings.
     */
    readControls() {
        const firstFrame = this.clamp(Number(this.elements.firstFrame.value), 0, 999);

        return {
            sws: this.clamp(Number(this.elements.sws.value), 1, 20),
            rws: this.clamp(Number(this.elements.rws.value), 1, 20),
            firstFrame,
            targetFrame: this.clamp(Number(this.elements.targetFrame.value), firstFrame, 999),
            failedFrames: this.parseFailedFrames(this.elements.lostFrames.value),
            timeoutRtt: this.clamp(Number(this.elements.timeoutRtt.value), 1, 10),

            axisGap: this.clampByElement(this.elements.axisGap),
            rttHeight: this.clampByElement(this.elements.spacing) * 2,
            speed: this.clampByElement(this.elements.speed)
        };
    }

    /**
     * Clamp a numeric input by its own min and max attributes.
     *
     * @param {HTMLInputElement} input - Numeric input.
     * @returns {number} Clamped value.
     */
    clampByElement(input) {
        return this.clamp(
            Number(input.value),
            Number(input.min),
            Number(input.max)
        );
    }

    /**
     * Create diagram layout from fixed settings and current UI controls.
     *
     * @returns {Object} Diagram layout.
     */
    createLayout() {
        const settings = SlidingWindowApp.DIAGRAM_SETTINGS;
        const senderX = settings.width / 2 - this.settings.axisGap / 2;
        const receiverX = settings.width / 2 + this.settings.axisGap / 2;

        return {
            width: settings.width,
            minimumHeight: settings.minimumHeight,

            senderX,
            receiverX,

            axisOverhang: settings.axis.overhang,
            axisLabelOffsetY: settings.axis.labelOffsetY,
            axisArrowSize: settings.axis.arrowSize,

            arrowLength: settings.arrow.length,
            arrowWidth: settings.arrow.width,

            timeGuideLabelGap: settings.timeGuide.labelGap,
            timeGuideExteriorDashWidth: settings.timeGuide.exteriorDashWidth,
            timeGuideInteriorDashCount: settings.timeGuide.interiorDashCount,
            timeGuideInteriorDashRatio: settings.timeGuide.interiorDashRatio,
            timeGuideTickWidth: settings.timeGuide.tickWidth,

            eventLabelWidth: settings.eventLabel.width,
            eventLabelHeight: settings.eventLabel.height,
            eventLabelOffset: settings.eventLabel.offset,

            lostFrameRatio: settings.lostFrameRatio,
            timeoutWidth: settings.timeoutWidth
        };
    }

    /**
     * Render current simulator state.
     */
    render() {
        this.layout = this.createLayout();

        const visibleEvents = this.events.slice(0, this.stepIndex);
        const maxTime = this.getMaxTime();
        const height = this.getDiagramHeight(maxTime);
        const svg = this.elements.diagram;

        Svg.clear(svg);
        svg.setAttribute("viewBox", `0 ${-this.layout.axisOverhang} ${this.layout.width} ${height}`);

        this.drawBackground(svg, height);
        this.drawTimelineBase(svg, maxTime);
        this.drawEvents(svg, visibleEvents);
        this.syncUi();
    }

    /**
     * Get diagram height including top and bottom overhang.
     *
     * @param {number} maxTime - Max timeline time.
     * @returns {number} Diagram height.
     */
    getDiagramHeight(maxTime) {
        const timelineHeight = Math.ceil(maxTime) * this.settings.rttHeight;
        const totalHeight = timelineHeight + this.layout.axisOverhang * 2;

        return Math.max(this.layout.minimumHeight, totalHeight);
    }

    /**
     * Get maximum timeline time.
     *
     * @returns {number} Max timeline time.
     */
    getMaxTime() {
        let maxTime = 4;

        for (const event of this.events) {
            if (event.type === "frame") {
                maxTime = Math.max(maxTime, event.data.receiveTime + 0.6);
            } else if (event.type === "ack" || event.type === "duplicate-ack" || event.type === "sack") {
                maxTime = Math.max(maxTime, event.data.ackArrivalTime + 0.35);
            } else if (event.type === "timeout") {
                maxTime = Math.max(maxTime, event.data.timeoutTime + 0.5);
            }
        }

        return maxTime;
    }

    /**
     * Draw diagram background.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} height - Diagram height.
     */
    drawBackground(svg, height) {
        Svg.rect(svg, 0, -this.layout.axisOverhang, this.layout.width, height, "diagram-background");
    }

    /**
     * Draw axes, labels, arrows, and time guides.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} maxTime - Max timeline time.
     */
    drawTimelineBase(svg, maxTime) {
        const lastRtt = Math.ceil(maxTime);
        const lastRttY = lastRtt * this.settings.rttHeight;
        const axisStartY = -this.layout.axisOverhang;
        const axisEndY = lastRttY + this.layout.axisOverhang;

        this.drawAxis(svg, this.layout.senderX, axisStartY, axisEndY);
        this.drawAxis(svg, this.layout.receiverX, axisStartY, axisEndY);

        this.drawAxisLabel(svg, this.layout.senderX, "Sender");
        this.drawAxisLabel(svg, this.layout.receiverX, "Receiver");

        this.drawAxisArrow(svg, this.layout.senderX, axisEndY);
        this.drawAxisArrow(svg, this.layout.receiverX, axisEndY);

        for (let rtt = 0; rtt <= lastRtt; rtt++) {
            this.drawTimeGuide(svg, rtt);
            this.drawTimeGuideTicks(svg, rtt);
        }
    }

    /**
     * Draw one vertical axis.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} x - Axis X coordinate.
     * @param {number} startY - Start Y coordinate.
     * @param {number} endY - End Y coordinate.
     */
    drawAxis(svg, x, startY, endY) {
        Svg.line(svg, x, startY, x, endY, "axis");
    }

    /**
     * Draw axis label.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} x - Label X coordinate.
     * @param {string} label - Label text.
     */
    drawAxisLabel(svg, x, label) {
        Svg.text(svg, label, x, this.layout.axisLabelOffsetY, "axis-label anchor-middle");
    }

    /**
     * Draw axis arrow.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} x - Arrow X coordinate.
     * @param {number} y - Arrow Y coordinate.
     */
    drawAxisArrow(svg, x, y) {
        const size = this.layout.axisArrowSize;
        const d = `M ${x} ${y} L ${x - size / 2} ${y - size} L ${x + size / 2} ${y - size} Z`;

        Svg.path(svg, d, "axis-arrow");
    }

    /**
     * Draw one RTT guide.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} rtt - RTT index.
     */
    drawTimeGuide(svg, rtt) {
        const y = rtt * this.settings.rttHeight;
        const label = rtt === 0 ? "STX" : `${rtt} RTT`;
        const senderX = this.layout.senderX;
        const receiverX = this.layout.receiverX;
        const exteriorWidth = this.layout.timeGuideExteriorDashWidth;
        const interiorCount = this.layout.timeGuideInteriorDashCount;
        const interiorWidth = receiverX - senderX;
        const dashWidth = interiorWidth * this.layout.timeGuideInteriorDashRatio;
        const gapWidth = (interiorWidth - dashWidth * interiorCount) / (interiorCount - 1);
        const leftDashStart = senderX - exteriorWidth;
        const rightDashEnd = receiverX + exteriorWidth;

        Svg.text(svg, label, leftDashStart - this.layout.timeGuideLabelGap, y + 6, "time-guide-label anchor-end");
        Svg.line(svg, leftDashStart, y, senderX, y, "time-guide-line");

        for (let index = 0; index < interiorCount; index++) {
            const x1 = senderX + index * (dashWidth + gapWidth);
            const x2 = x1 + dashWidth;

            Svg.line(svg, x1, y, x2, y, "time-guide-line");
        }

        Svg.line(svg, receiverX, y, rightDashEnd, y, "time-guide-line");
    }

    /**
     * Draw RTT subdivision ticks.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} rtt - RTT index.
     */
    drawTimeGuideTicks(svg, rtt) {
        const baseY = rtt * this.settings.rttHeight;
        const halfTickWidth = this.layout.timeGuideTickWidth / 2;

        for (let tick = 1; tick < this.settings.sws; tick++) {
            const y = baseY + tick / this.settings.sws * this.settings.rttHeight;

            Svg.line(svg, this.layout.senderX - halfTickWidth, y, this.layout.senderX + halfTickWidth, y, "time-guide-tick");
            Svg.line(svg, this.layout.receiverX - halfTickWidth, y, this.layout.receiverX + halfTickWidth, y, "time-guide-tick");
        }
    }

    /**
     * Draw visible timeline events.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {Array} events - Timeline events.
     */
    drawEvents(svg, events) {
        for (const event of events) {
            if (event.type === "frame") {
                this.drawFrameEvent(svg, event.data);
            } else if (event.type === "ack" || event.type === "duplicate-ack" || event.type === "sack") {
                this.drawAckEvent(svg, event.data, event.type);
            } else if (event.type === "timeout") {
                this.drawTimeoutEvent(svg, event.data);
            }
        }
    }

    /**
     * Draw frame event.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {FrameBehavior} frame - Frame event.
     */
    drawFrameEvent(svg, frame) {
        const startY = frame.sendTime * this.settings.rttHeight;
        const endY = frame.receiveTime * this.settings.rttHeight;
        const label = `FRAME ${frame.seqNum}${frame.retransmitted ? " (R)" : ""}`;
        const className = this.getFrameEventClass(frame);

        if (frame.lost) {
            this.drawLostFrameEvent(svg, startY, endY, label, className);
        } else {
            this.drawEventArrow(svg, this.layout.senderX, startY, this.layout.receiverX, endY, className);
            this.drawEventLabel(svg, this.layout.senderX, startY, this.layout.receiverX, endY, label, className);
        }
    }

    /**
     * Get frame event classes.
     *
     * @param {FrameBehavior} frame - Frame event.
     * @returns {string} CSS classes.
     */
    getFrameEventClass(frame) {
        const classes = ["event", "event-frame"];

        if (frame.lost) {
            classes.push("is-lost");
        }

        if (frame.retransmitted) {
            classes.push("is-retransmission");
        }

        return classes.join(" ");
    }

    /**
     * Draw lost frame event.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} startY - Start Y coordinate.
     * @param {number} endY - End Y coordinate.
     * @param {string} label - Label text.
     * @param {string} className - Event class.
     */
    drawLostFrameEvent(svg, startY, endY, label, className) {
        const lostEndX = this.layout.senderX + (this.layout.receiverX - this.layout.senderX) * this.layout.lostFrameRatio;
        const lostEndY = startY + (endY - startY) * this.layout.lostFrameRatio;

        Svg.line(svg, this.layout.senderX, startY, lostEndX, lostEndY, `${className} event-line`);
        this.drawEventLabel(svg, this.layout.senderX, startY, this.layout.receiverX, endY, label, className);
        Svg.text(svg, "✕", lostEndX + 10, lostEndY + 7, "event-loss-mark");
    }

    /**
     * Draw acknowledgement event.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {AckEvent} ack - ACK event.
     * @param {string} type - ACK type.
     */
    drawAckEvent(svg, ack, type) {
        const startY = ack.receiveTime * this.settings.rttHeight;
        const endY = ack.ackArrivalTime * this.settings.rttHeight;
        const className = this.getAckEventClass(type);
        const label = this.getAckLabel(ack, type);

        this.drawEventArrow(svg, this.layout.receiverX, startY, this.layout.senderX, endY, className);
        this.drawEventLabel(svg, this.layout.receiverX, startY, this.layout.senderX, endY, label, className);
    }

    /**
     * Get ACK event classes.
     *
     * @param {string} type - ACK type.
     * @returns {string} CSS classes.
     */
    getAckEventClass(type) {
        const classes = ["event", "event-ack"];

        if (type === "duplicate-ack") {
            classes.push("is-duplicate");
        }

        if (type === "sack") {
            classes.push("is-sack");
        }

        return classes.join(" ");
    }

    /**
     * Get ACK label.
     *
     * @param {AckEvent} ack - ACK event.
     * @param {string} type - ACK type.
     * @returns {string} ACK label.
     */
    getAckLabel(ack, type) {
        let label = `ACK ${ack.ackNum}`;

        if (type === "duplicate-ack") {
            label = `DUPACK ${ack.ackNum}`;
        } else if (type === "sack") {
            label = `SACK ${ack.ackNum}`;
        }

        return label;
    }

    /**
     * Draw timeout event.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {Timeout} timeout - Timeout event.
     */
    drawTimeoutEvent(svg, timeout) {
        const y = timeout.timeoutTime * this.settings.rttHeight;
        const suffix = timeout.retransmitCount > 0 ? ` (R${timeout.retransmitCount})` : "";
        const halfWidth = this.layout.timeoutWidth / 2;

        Svg.line(svg, this.layout.senderX - halfWidth, y, this.layout.senderX + halfWidth, y, "event event-timeout event-line");
        Svg.text(svg, `TIMEOUT${suffix}`, this.layout.senderX + halfWidth + 5, y + 5, "event event-timeout event-label-text");
    }

    /**
     * Draw event line with arrowhead.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} x1 - Start X.
     * @param {number} y1 - Start Y.
     * @param {number} x2 - End X.
     * @param {number} y2 - End Y.
     * @param {string} className - Event class.
     */
    drawEventArrow(svg, x1, y1, x2, y2, className) {
        Svg.line(svg, x1, y1, x2, y2, `${className} event-line`);
        this.drawEventArrowHead(svg, x1, y1, x2, y2, `${className} event-arrow`);
    }

    /**
     * Draw event arrowhead.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} x1 - Start X.
     * @param {number} y1 - Start Y.
     * @param {number} x2 - End X.
     * @param {number} y2 - End Y.
     * @param {string} className - Event class.
     */
    drawEventArrowHead(svg, x1, y1, x2, y2, className) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const leftAngle = angle + Math.PI * 0.86;
        const rightAngle = angle - Math.PI * 0.86;
        const leftX = x2 + Math.cos(leftAngle) * this.layout.arrowLength;
        const leftY = y2 + Math.sin(leftAngle) * this.layout.arrowLength;
        const rightX = x2 + Math.cos(rightAngle) * this.layout.arrowLength;
        const rightY = y2 + Math.sin(rightAngle) * this.layout.arrowLength;
        const d = `M ${x2} ${y2} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`;

        Svg.path(svg, d, className);
    }

    /**
     * Draw event label.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} x1 - Line start X.
     * @param {number} y1 - Line start Y.
     * @param {number} x2 - Line end X.
     * @param {number} y2 - Line end Y.
     * @param {string} label - Label text.
     * @param {string} className - Event class.
     */
    drawEventLabel(svg, x1, y1, x2, y2, label, className) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lineLength = Math.hypot(dx, dy);

        let labelX = x1;
        let labelY = y1;

        if (lineLength > 0) {
            labelX += dx / lineLength * this.layout.eventLabelOffset;
            labelY += dy / lineLength * this.layout.eventLabelOffset;
        }

        let angle = Math.atan2(dy, dx) * 180 / Math.PI;

        if (angle > 90 || angle < -90) {
            angle += 180;
        }

        const group = Svg.group(svg, `${className} event-label`);
        group.setAttribute("transform", `rotate(${angle} ${labelX} ${labelY})`);

        Svg.rect(
            group,
            labelX - this.layout.eventLabelWidth / 2,
            labelY - this.layout.eventLabelHeight / 2,
            this.layout.eventLabelWidth,
            this.layout.eventLabelHeight,
            "event-label-box"
        );

        Svg.text(group, label, labelX, labelY + 4, "event-label-text anchor-middle");
    }

    /**
     * Update visible control values.
     */
    updateDashboardValues() {
        this.elements.axisGapValue.textContent = this.elements.axisGap.value;
        this.elements.spacingValue.textContent = this.elements.spacing.value;
        this.elements.speedValue.textContent = this.elements.speed.value;
    }

    /**
     * Sync UI status and button states.
     */
    syncUi() {
        this.updateDashboardValues();
        this.elements.statusPill.textContent = `Step ${this.stepIndex} / ${this.events.length}`;
        this.elements.prevButton.disabled = this.stepIndex === 0;
        this.elements.nextButton.disabled = this.stepIndex >= this.events.length;
    }

    /**
     * Step forward.
     */
    stepForward() {
        if (this.stepIndex < this.events.length) {
            this.stepIndex++;
            this.render();
        } else {
            this.stop();
        }
    }

    /**
     * Step backward.
     */
    stepBackward() {
        if (this.stepIndex > 0) {
            this.stepIndex--;
            this.render();
        }
    }

    /**
     * Run playback.
     */
    run() {
        this.stop();

        if (this.settings.speed === 0) {
            this.stepIndex = this.events.length;
            this.render();
        } else {
            this.timer = setInterval(this.stepTimer.bind(this), this.settings.speed);
        }
    }

    /**
     * Advance playback timer.
     */
    stepTimer() {
        if (this.stepIndex >= this.events.length) {
            this.stop();
        } else {
            this.stepForward();
        }
    }

    /**
     * Stop playback.
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Reset playback.
     */
    reset() {
        this.stop();
        this.stepIndex = 0;
        this.render();
    }

    /**
     * Download current SVG.
     */
    downloadSvg() {
        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(this.elements.diagram);
        const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "sliding-window-timeline.svg";
        link.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Clamp number to range.
     *
     * @param {number} value - Value.
     * @param {number} min - Minimum.
     * @param {number} max - Maximum.
     * @returns {number} Clamped value.
     */
    clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    /**
     * Parse failed frame list.
     *
     * @param {string} raw - Raw comma-separated input.
     * @returns {Set<number>} Failed frame numbers.
     */
    parseFailedFrames(raw) {
        const failedFrames = new Set();
        const parts = String(raw).split(",");

        for (const part of parts) {
            const value = Number(part.trim());

            if (Number.isInteger(value) && value >= 0) {
                failedFrames.add(value);
            }
        }

        return failedFrames;
    }
}

document.addEventListener("DOMContentLoaded", function initializeApplication() {
    new SlidingWindowApp();
});
