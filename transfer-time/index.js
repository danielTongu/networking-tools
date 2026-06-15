"use strict";

import Svg from "../svg-utility.js";

/**
 * Unit conversion helper for file sizes, distances, bandwidth, and time units.
 */
class UnitConverter {
    /**
     * Create a unit converter with predefined conversion factors.
     */
    constructor() {
        /**
         * Binary exponent for file size units (powers of 1024)
         */
        this.bytePowers = Object.freeze({
            KB: 1,
            MB: 2,
            GB: 3,
            TB: 4
        });

        /**
         * Distance conversion factors to meters
         */
        this.distanceFactors = Object.freeze({
            m: 1,
            km: 1000,
            mi: 1609.344,
            ft: 0.3048,
            yd: 0.9144
        });

        /**
         * Bandwidth conversion factors to bits per second
         */
        this.bandwidthFactors = Object.freeze({
            bps: 1,
            kbps: 1000,
            Mbps: 1000000,
            Gbps: 1000000000,
            Tbps: 1000000000000
        });
    }

    /**
     * Get the base-1024 exponent for a file unit.
     *
     * @param {string} unit - File unit (KB, MB, GB, TB).
     * @returns {number} Unit exponent.
     */
    getBytePower(unit) {
        return this.bytePowers[unit] ?? 0;
    }

    /**
     * Convert file size to bytes.
     *
     * @param {number} value - File size value.
     * @param {string} unit - File unit.
     * @returns {number} Size in bytes.
     */
    toBytes(value, unit) {
        return value * Math.pow(1024, this.getBytePower(unit));
    }

    /**
     * Convert bytes to bits.
     *
     * @param {number} bytes - Size in bytes.
     * @returns {number} Size in bits.
     */
    bytesToBits(bytes) {
        return bytes * 8;
    }

    /**
     * Convert distance to meters.
     *
     * @param {number} value - Distance value.
     * @param {string} unit - Distance unit (m, km, mi, ft, yd).
     * @returns {number} Distance in meters.
     */
    toMeters(value, unit) {
        return value * (this.distanceFactors[unit] ?? 1);
    }

    /**
     * Convert bandwidth to bits per second.
     *
     * @param {number} value - Bandwidth value.
     * @param {string} unit - Bandwidth unit (bps, kbps, Mbps, Gbps, Tbps).
     * @returns {number} Bandwidth in bits per second.
     */
    toBps(value, unit) {
        return value * (this.bandwidthFactors[unit] ?? 1);
    }

    /**
     * Convert time value to seconds.
     *
     * @param {number} value - Time value.
     * @param {string} unit - Time unit (us, ms, s).
     * @returns {number} Time in seconds.
     */
    toSeconds(value, unit) {
        let seconds = value;
        if (unit === "us") seconds = value / 1000000;
        else if (unit === "ms") seconds = value / 1000;
        return seconds;
    }
}

/**
 * Stores worksheet reference values by id for cross-table references.
 */
class WorksheetReferences {
    /**
     * Create reference storage.
     */
    constructor() {
        this.values = new Map();
    }

    /**
     * Remove all references.
     */
    clear() {
        this.values.clear();
    }

    /**
     * Store a reference value.
     *
     * @param {string} id - Reference identifier.
     * @param {string} value - Display value.
     */
    set(id, value) {
        this.values.set(id, value);
    }

    /**
     * Get a stored reference value.
     *
     * @param {string} id - Reference identifier.
     * @returns {string} Display value or empty string.
     */
    get(id) {
        return this.values.get(id) ?? "";
    }
}

/**
 * Utility for safely managing HTML table bodies.
 */
class TableBody {
    /**
     * Create a table body helper.
     *
     * @param {HTMLTableSectionElement} tbody - Table body element.
     */
    constructor(tbody) {
        this.tbody = tbody;
    }

    /**
     * Remove all rows from the table body.
     */
    clear() {
        this.tbody.textContent = "";
    }

    /**
     * Replace all rows with new data.
     *
     * @param {Array<Array<string|number>>} rows - Row data arrays.
     */
    setRows(rows) {
        this.clear();
        rows.forEach(row => this.appendRow(row));
    }

    /**
     * Append a normal row.
     *
     * @param {Array<string|number|Object>} cells - Cell values.
     */
    appendRow(cells) {
        this.tbody.appendChild(this.createRow(cells, false, ""));
    }

    /**
     * Append a referenced row (for cross-table references).
     *
     * @param {string} referenceId - Reference identifier.
     * @param {Array<string|number|Object>} cells - Cell values.
     */
    appendReferenceRow(referenceId, cells) {
        this.tbody.appendChild(this.createRow(cells, false, referenceId));
    }

    /**
     * Append a total row (styled differently).
     *
     * @param {string} referenceId - Reference identifier.
     * @param {Array<string|number|Object>} cells - Cell values.
     */
    appendTotalRow(referenceId, cells) {
        this.tbody.appendChild(this.createRow(cells, true, referenceId));
    }

    /**
     * Create a table row element.
     *
     * @param {Array<string|number|Object>} cells - Cell values.
     * @param {boolean} isTotal - Whether this is a total row.
     * @param {string} referenceId - Reference identifier.
     * @returns {HTMLTableRowElement} Table row.
     */
    createRow(cells, isTotal, referenceId) {
        const row = document.createElement("tr");

        if (isTotal) row.classList.add("total-row");
        if (referenceId) row.dataset.referenceId = referenceId;

        cells.forEach(cell => {
            const td = document.createElement("td");
            if (typeof cell === "object" && cell !== null) {
                td.textContent = cell.text;
                td.dataset.referenceId = cell.referenceId;
            } else {
                td.textContent = String(cell);
            }
            row.appendChild(td);
        });

        return row;
    }
}

/**
 * Dynamic network-transfer worksheet and topology app.
 */
export default class TransferTimeApp {
    static DIAGRAM_SETTINGS = Object.freeze({
        minimumWidth: 1050,
        height: 260,

        paddingX: 90,
        nodeY: 125,

        host: Object.freeze({
            radius: 22
        }),

        switch: Object.freeze({
            width: 56,
            height: 46,
            radius: 4,
            labelOffsetY: 58
        }),

        link: Object.freeze({
            labelOffsetY: -44
        })
    });

    static MEDIUM_SPEEDS = Object.freeze({
        vacuum: 300000000,
        optical: 200000000,
        copper: 230000000
    });

    /**
     * Create the transfer-time application.
     */
    constructor() {
        this.converter = new UnitConverter();
        this.references = new WorksheetReferences();
        this.elements = this.getElements();
        this.tables = this.createTables();
        this.links = [];
        this.switchDelays = [];

        this.bindEvents();
        this.loadDefaultExample();
        this.renderForms();
        this.renderResults();
        this.syncResultsHeight();
    }

    /**
     * Get DOM elements used by the application.
     *
     * @returns {Object} DOM element references.
     */
    getElements() {
        return {
            appAside: document.querySelector("main > aside"),
            resultsSection: document.querySelector("main > section"),

            fileSize: document.getElementById("file-size"),
            fileUnit: document.getElementById("file-unit"),
            mssBytes: document.getElementById("mss-bytes"),
            handshakeRtts: document.getElementById("handshake-rtts"),

            linksForm: document.getElementById("links-form"),
            switchesForm: document.getElementById("switches-form"),
            addSwitchBtn: document.getElementById("add-switch-btn"),

            linkCardTemplate: document.getElementById("link-card-template"),
            switchCardTemplate: document.getElementById("switch-card-template"),

            diagram: document.getElementById("transfer-diagram"),

            summaryCircuitRtt: document.querySelector('[data-field="circuit-rtt"]'),
            summaryTotalTransferTime: document.querySelector('[data-field="total-transfer-time"]'),

            tableBodies: {
                fileConversion: document.querySelector('[data-table="file-conversion"]'),
                propagationDelay: document.querySelector('[data-table="propagation-delay"]'),
                rtt: document.querySelector('[data-table="rtt"]'),
                transmitTime: document.querySelector('[data-table="transmit-time"]'),
                switchDelay: document.querySelector('[data-table="switch-delay"]'),
                circuitRtt: document.querySelector('[data-table="circuit-rtt"]'),
                totalTransferTime: document.querySelector('[data-table="total-transfer-time"]')
            }
        };
    }

    /**
     * Create table helper objects.
     *
     * @returns {Object} Table helpers.
     */
    createTables() {
        return {
            fileConversion: new TableBody(this.elements.tableBodies.fileConversion),
            propagationDelay: new TableBody(this.elements.tableBodies.propagationDelay),
            rtt: new TableBody(this.elements.tableBodies.rtt),
            transmitTime: new TableBody(this.elements.tableBodies.transmitTime),
            switchDelay: new TableBody(this.elements.tableBodies.switchDelay),
            circuitRtt: new TableBody(this.elements.tableBodies.circuitRtt),
            totalTransferTime: new TableBody(this.elements.tableBodies.totalTransferTime)
        };
    }

    /**
     * Bind application events.
     */
    bindEvents() {
        this.bindResultInput(this.elements.fileSize);
        this.bindResultInput(this.elements.fileUnit);
        this.bindResultInput(this.elements.mssBytes);
        this.bindResultInput(this.elements.handshakeRtts);

        this.elements.addSwitchBtn.addEventListener("click", this.addSwitch.bind(this));
        window.addEventListener("resize", this.syncResultsHeight.bind(this));
    }

    /**
     * Synchronize the results panel height with the controls panel.
     *
     * This method works together with the desktop layout rules in `index.css`.
     * The CSS provides the fallback layout and scrolling behavior, while this function measures the rendered height of
     * `main > aside` and applies it as the `max-height` of
     * `main > section`, preventing the results' content from stretching the overall grid.
     *
     * If the related CSS is changed or removed, review this method as well, since both implementations are intentionally coupled.
     */
    syncResultsHeight() {
        const isDesktop = window.matchMedia("(min-width: 1000px)").matches;
        const aside = this.elements.appAside;
        const section = this.elements.resultsSection;

        if (isDesktop) {
            section.style.maxHeight = `${aside.offsetHeight}px`;
            section.style.overflowY = "auto";
        } else {
            section.style.maxHeight = "";
            section.style.overflowY = "";
        }
    }

    /**
     * Bind a control that only recalculates results.
     *
     * @param {HTMLElement} input - Input element.
     */
    bindResultInput(input) {
        input.addEventListener("input", this.renderResults.bind(this));
        input.addEventListener("change", this.renderResults.bind(this));
    }

    /**
     * Load default example topology.
     */
    loadDefaultExample() {
        this.links = [
            this.createLink("Link 1", 53, "m", "vacuum", 300000000, 250, "Mbps"),
            this.createLink("Link 2", 896, "km", "optical", 200000000, 36, "Gbps"),
            this.createLink("Link 3", 4200, "km", "optical", 200000000, 12, "Gbps"),
            this.createLink("Link 4", 76, "m", "copper", 230000000, 400, "Mbps")
        ];

        this.switchDelays = [
            { delay: 59, delayUnit: "us" },
            { delay: 62, delayUnit: "us" },
            { delay: 55, delayUnit: "us" }
        ];

        this.syncSwitchDelays();
    }

    /**
     * Create link data.
     *
     * @param {string} name - Link name.
     * @param {number} distance - Distance value.
     * @param {string} distanceUnit - Distance unit.
     * @param {string} medium - Medium key.
     * @param {number} customSpeed - Custom propagation speed.
     * @param {number} bandwidth - Bandwidth value.
     * @param {string} bandwidthUnit - Bandwidth unit.
     * @returns {Object} Link data.
     */
    createLink(name, distance, distanceUnit, medium, customSpeed, bandwidth, bandwidthUnit) {
        return {name, distance, distanceUnit, medium, customSpeed, bandwidth, bandwidthUnit};
    }

    /**
     * Create default link data.
     *
     * @param {number} index - Link index.
     * @returns {Object} Link data.
     */
    createDefaultLink(index) {
        return this.createLink(`Link ${index + 1}`, 1, "km", "optical", 200000000, 1, "Gbps");
    }

    /**
     * Add a switch and the trailing link it creates.
     */
    addSwitch() {
        const switchIndex = this.switchDelays.length;
        const trailingLinkIndex = switchIndex + 1;

        this.switchDelays.push({ delay: 50, delayUnit: "us" });
        this.links.splice(trailingLinkIndex, 0, this.createDefaultLink(trailingLinkIndex));
        this.renumberLinks();
        this.renderForms();
        this.renderResults();
    }

    /**
     * Remove a switch and its trailing link.
     *
     * @param {number} switchIndex - Switch index.
     */
    removeSwitch(switchIndex) {
        const trailingLinkIndex = switchIndex + 1;

        if (trailingLinkIndex < this.links.length) {
            this.links.splice(trailingLinkIndex, 1);
        }

        this.switchDelays.splice(switchIndex, 1);
        this.renumberLinks();
        this.syncSwitchDelays();
        this.renderForms();
        this.renderResults();
    }

    /**
     * Rename links sequentially.
     */
    renumberLinks() {
        this.links.forEach(function renameLink(link, index) {
            link.name = `Link ${index + 1}`;
        });
    }

    /**
     * Keep switch count aligned with link count.
     */
    syncSwitchDelays() {
        const requiredSwitchCount = Math.max(0, this.links.length - 1);

        while (this.switchDelays.length < requiredSwitchCount) {
            this.switchDelays.push({ delay: 50, delayUnit: "us" });
        }

        while (this.switchDelays.length > requiredSwitchCount) {
            this.switchDelays.pop();
        }
    }

    /**
     * Render editable forms.
     */
    renderForms() {
        this.renderLinkForms();
        this.renderSwitchForms();
        this.syncResultsHeight();
    }

    /**
     * Render calculated results.
     */
    renderResults() {
        const result = this.calculate();

        this.references.clear();
        this.renderDiagram(result);
        this.renderSummary(result);
        this.renderWorksheet(result);
        this.syncResultsHeight();
    }

    /**
     * Render link cards.
     */
    renderLinkForms() {
        this.elements.linksForm.textContent = "";

        this.links.forEach((link, index) => {
            const fragment = this.elements.linkCardTemplate.content.cloneNode(true);
            const card = fragment.querySelector("fieldset");
            const removeButton = card.querySelector(".remove-btn");

            card.querySelector("legend").textContent = link.name;
            this.setTemplateFields(card, "link", index, link);

            if (removeButton) {
                removeButton.remove();
            }

            card.querySelectorAll("[data-link]").forEach(field => {
                field.addEventListener("input", () => this.handleLinkInput(field));
                field.addEventListener("change", () => this.handleLinkInput(field));
            });

            this.setupLinkCard(card);
            this.elements.linksForm.appendChild(fragment);
        });
    }

    /**
     * Toggle custom speed input for a link card.
     *
     * @param {HTMLElement} card - Link card.
     */
    setupLinkCard(card) {
        const mediumField = card.querySelector('[data-field="medium"]');
        const customSpeedField = card.querySelector('[data-field="custom-speed"]');
        const customSpeedLabel = customSpeedField.closest("label");

        customSpeedLabel.hidden = mediumField.value !== "custom";

        mediumField.addEventListener("change", function toggleCustomSpeed() {
            customSpeedLabel.hidden = mediumField.value !== "custom";
        });
    }

    /**
     * Render switch cards.
     */
    renderSwitchForms() {
        this.elements.switchesForm.textContent = "";

        this.switchDelays.forEach((switchDelay, index) => {
            const fragment = this.elements.switchCardTemplate.content.cloneNode(true);
            const card = fragment.querySelector("fieldset");
            const removeButton = card.querySelector(".remove-btn");

            card.querySelector("legend").textContent = `Switch ${index + 1}`;
            this.setTemplateFields(card, "switch", index, switchDelay);

            removeButton.dataset.removeSwitch = String(index);
            removeButton.addEventListener("click", () => this.removeSwitch(index));

            card.querySelectorAll("[data-switch]").forEach(field => {
                field.addEventListener("input", () => this.handleSwitchInput(field));
                field.addEventListener("change", () => this.handleSwitchInput(field));
            });

            this.elements.switchesForm.appendChild(fragment);
        });
    }

    /**
     * Set cloned template fields.
     *
     * @param {HTMLElement} card - Template card.
     * @param {string} type - Dataset type.
     * @param {number} index - Item index.
     * @param {Object} data - Data object.
     */
    setTemplateFields(card, type, index, data) {
        card.querySelectorAll("[data-field]").forEach(field => {
            field.dataset[type] = String(index);

            if (Object.prototype.hasOwnProperty.call(data, field.dataset.field)) {
                field.value = data[field.dataset.field];
            }
        });
    }

    /**
     * Handle link input.
     *
     * @param {HTMLElement} field - Changed field.
     */
    handleLinkInput(field) {
        const index = Number(field.dataset.link);
        const fieldName = field.dataset.field;
        const numericFields = new Set(["distance", "custom-speed", "bandwidth"]);
        const link = this.links[index];

        if (numericFields.has(fieldName)) {
            link[fieldName] = this.toFiniteNumber(field.value, 0);
        } else {
            link[fieldName] = field.value;
        }

        if (fieldName === "name") {
            this.updateLinkLegend(index, field.value);
        }

        this.renderResults();
    }

    /**
     * Handle switch input.
     *
     * @param {HTMLElement} field - Changed field.
     */
    handleSwitchInput(field) {
        const index = Number(field.dataset.switch);
        const fieldName = field.dataset.field;
        const switchDelay = this.switchDelays[index];

        if (fieldName === "delay") {
            switchDelay[fieldName] = this.toFiniteNumber(field.value, 0);
        } else {
            switchDelay[fieldName] = field.value;
        }

        this.renderResults();
    }

    /**
     * Update link card legend.
     *
     * @param {number} index - Link index.
     * @param {string} name - New name.
     */
    updateLinkLegend(index, name) {
        const field = this.elements.linksForm.querySelector(`[data-link="${index}"][data-field="name"]`);
        const card = field.closest("fieldset");

        card.querySelector("legend").textContent = name || `Link ${index + 1}`;
    }

    /**
     * Calculate all worksheet values.
     *
     * @returns {Object} Calculation result.
     */
    calculate() {
        const fileBytes = this.converter.toBytes(
            this.toFiniteNumber(this.elements.fileSize.value, 0),
            this.elements.fileUnit.value
        );
        const fileBits = this.converter.bytesToBits(fileBytes);
        const mssBytes = Math.max(1, this.toFiniteNumber(this.elements.mssBytes.value, 1));
        const packetCount = Math.ceil(fileBytes / mssBytes);
        const handshakeRtts = this.toFiniteNumber(this.elements.handshakeRtts.value, 0);

        const linkRows = this.links.map(link => this.calculateLink(link, fileBits));
        const switchRows = this.switchDelays.map((switchDelay, index) =>
            this.calculateSwitch(switchDelay, index, packetCount)
        );

        const totalPropagation = this.sum(linkRows, "propagationDelay");
        const totalLinkRtt = this.sum(linkRows, "rtt");
        const totalTransmit = this.sum(linkRows, "transmitTime");
        const totalSwitchPerPacket = this.sum(switchRows, "delaySeconds");
        const totalSwitchDelay = this.sum(switchRows, "totalDelay");
        const switchRttPortion = 2 * totalSwitchPerPacket;
        const circuitRtt = totalLinkRtt + switchRttPortion;
        const handshakeTime = handshakeRtts * circuitRtt;
        const totalTransferTime = handshakeTime + totalTransmit + totalPropagation + totalSwitchDelay;

        return {
            fileBytes,
            fileBits,
            mssBytes,
            packetCount,
            handshakeRtts,
            handshakeTime,
            linkRows,
            switchRows,
            totalPropagation,
            totalLinkRtt,
            totalTransmit,
            totalSwitchPerPacket,
            totalSwitchDelay,
            switchRttPortion,
            circuitRtt,
            totalTransferTime
        };
    }

    /**
     * Calculate one link row.
     *
     * @param {Object} link - Link data.
     * @param {number} fileBits - File size in bits.
     * @returns {Object} Link calculation row.
     */
    calculateLink(link, fileBits) {
        const distanceMeters = this.converter.toMeters(link.distance, link.distanceUnit);
        const speed = this.getLinkSpeed(link);
        const bandwidthBps = this.converter.toBps(link.bandwidth, link.bandwidthUnit);
        const propagationDelay = speed > 0 ? distanceMeters / speed : 0;
        const rtt = propagationDelay * 2;
        const transmitTime = bandwidthBps > 0 ? fileBits / bandwidthBps : 0;

        return Object.assign({}, link, {distanceMeters, speed, bandwidthBps, propagationDelay, rtt, transmitTime});
    }

    /**
     * Calculate one switch row.
     *
     * @param {Object} switchDelay - Switch delay data.
     * @param {number} index - Switch index.
     * @param {number} packetCount - Packet count.
     * @returns {Object} Switch calculation row.
     */
    calculateSwitch(switchDelay, index, packetCount) {
        const delaySeconds = this.converter.toSeconds(switchDelay.delay, switchDelay.delayUnit);
        const totalDelay = packetCount * delaySeconds;

        return {
            name: `Switch ${index + 1}`,
            delaySeconds,
            totalDelay
        };
    }

    /**
     * Get propagation speed for a link.
     *
     * @param {Object} link - Link data.
     * @returns {number} Speed in m/s.
     */
    getLinkSpeed(link) {
        let speed = TransferTimeApp.MEDIUM_SPEEDS[link.medium] || 0;

        if (link.medium === "custom") {
            speed = link.customSpeed;
        }

        return Math.max(0, this.toFiniteNumber(speed, 0));
    }

    /**
     * Render all worksheet tables.
     *
     * @param {Object} result - Calculation result.
     */
    renderWorksheet(result) {
        this.renderFileConversionTable(result);
        this.renderPropagationTable(result);
        this.renderRttTable(result);
        this.renderTransmitTable(result);
        this.renderSwitchDelayTable(result);
        this.renderCircuitRttTable(result);
        this.renderTotalTransferTimeTable(result);
    }

    /**
     * Render file conversion table.
     *
     * @param {Object} result - Calculation result.
     */
    renderFileConversionTable(result) {
        const fileUnitPower = this.converter.getBytePower(this.elements.fileUnit.value);

        this.tables.fileConversion.setRows([
            ["File Bytes", `${this.elements.fileSize.value} ${this.elements.fileUnit.value} × 1024${this.toSuperscript(fileUnitPower)}`, `${this.format(result.fileBytes)} bytes`],
            ["File Bits", `${this.format(result.fileBytes)} × 8`, `${this.format(result.fileBits)} bits`],
            ["MSS", "Given", `${this.format(result.mssBytes)} bytes`],
            ["Packet Count", `ceil(${this.format(result.fileBytes)} ÷ ${this.format(result.mssBytes)})`, `${this.format(result.packetCount)} packets`]
        ]);
    }

    /**
     * Render propagation delay table.
     *
     * @param {Object} result - Calculation result.
     */
    renderPropagationTable(result) {
        const referenceId = "total-propagation-delay";

        this.tables.propagationDelay.clear();

        result.linkRows.forEach(row => {
            this.tables.propagationDelay.appendRow([
                row.name,
                `${this.format(row.distanceMeters)} m ÷ ${this.format(row.speed)} m/s`,
                `${row.propagationDelay.toFixed(12)} s`
            ]);
        });

        this.references.set(referenceId, `${result.totalPropagation.toFixed(12)} s`);
        this.tables.propagationDelay.appendTotalRow(referenceId, [
            "Total Propagation Delay",
            this.sumExpression(result.linkRows, "propagationDelay", 12),
            this.references.get(referenceId)
        ]);
    }

    /**
     * Render RTT table.
     *
     * @param {Object} result - Calculation result.
     */
    renderRttTable(result) {
        const referenceId = "total-link-rtt";

        this.tables.rtt.clear();

        result.linkRows.forEach(row => {
            this.tables.rtt.appendRow([
                row.name,
                `2 × ${row.propagationDelay.toFixed(12)} s`,
                `${row.rtt.toFixed(12)} s`
            ]);
        });

        this.references.set(referenceId, `${result.totalLinkRtt.toFixed(12)} s`);
        this.tables.rtt.appendTotalRow(referenceId, [
            "Total Link RTT",
            this.sumExpression(result.linkRows, "rtt", 12),
            this.references.get(referenceId)
        ]);
    }

    /**
     * Render transmit time table.
     *
     * @param {Object} result - Calculation result.
     */
    renderTransmitTable(result) {
        const referenceId = "total-transmission-time";

        this.tables.transmitTime.clear();

        result.linkRows.forEach(row => {
            this.tables.transmitTime.appendRow([
                row.name,
                `${this.format(result.fileBits)} bits ÷ ${this.format(row.bandwidthBps)} bps`,
                `${row.transmitTime.toFixed(9)} s`
            ]);
        });

        this.references.set(referenceId, `${result.totalTransmit.toFixed(9)} s`);
        this.tables.transmitTime.appendTotalRow(referenceId, [
            "Total Transmission Time",
            this.sumExpression(result.linkRows, "transmitTime", 9),
            this.references.get(referenceId)
        ]);
    }

    /**
     * Render switch delay table.
     *
     * @param {Object} result - Calculation result.
     */
    renderSwitchDelayTable(result) {
        const referenceId = "total-switch-delay";

        this.tables.switchDelay.clear();

        result.switchRows.forEach(row => {
            this.tables.switchDelay.appendRow([
                row.name,
                `${this.format(result.packetCount)} packets × ${row.delaySeconds.toFixed(9)} s`,
                `${row.totalDelay.toFixed(9)} s`
            ]);
        });

        this.references.set(referenceId, `${result.totalSwitchDelay.toFixed(9)} s`);
        this.tables.switchDelay.appendTotalRow(referenceId, [
            "Total Switch Delay",
            this.sumExpression(result.switchRows, "totalDelay", 9),
            this.references.get(referenceId)
        ]);
    }

    /**
     * Render circuit RTT table.
     *
     * @param {Object} result - Calculation result.
     */
    renderCircuitRttTable(result) {
        const referenceId = "circuit-rtt-total";

        this.tables.circuitRtt.setRows([
            ["Total Link RTT", { text: "Reference: total-link-rtt", referenceId: "total-link-rtt" }, this.references.get("total-link-rtt")],
            ["Switch Delay Per Packet", this.sumExpression(result.switchRows, "delaySeconds", 12), `${result.totalSwitchPerPacket.toFixed(12)} s`],
            ["Switch RTT Portion", `2 × ${result.totalSwitchPerPacket.toFixed(12)} s`, `${result.switchRttPortion.toFixed(12)} s`]
        ]);

        this.references.set(referenceId, `${result.circuitRtt.toFixed(12)} s`);
        this.tables.circuitRtt.appendTotalRow(referenceId, [
            "Total Circuit RTT",
            `${result.totalLinkRtt.toFixed(12)} + ${result.switchRttPortion.toFixed(12)}`,
            this.references.get(referenceId)
        ]);
    }

    /**
     * Render total transfer time table.
     *
     * @param {Object} result - Calculation result.
     */
    renderTotalTransferTimeTable(result) {
        const referenceId = "total-transfer-time";

        this.tables.totalTransferTime.setRows([
            ["Handshake", `${result.handshakeRtts} × ${this.references.get("circuit-rtt-total")}`, `${result.handshakeTime.toFixed(9)} s`],
            ["Transmission", { text: "Reference: total-transmission-time", referenceId: "total-transmission-time" }, this.references.get("total-transmission-time")],
            ["Propagation", { text: "Reference: total-propagation-delay", referenceId: "total-propagation-delay" }, this.references.get("total-propagation-delay")],
            ["Switch Delay", { text: "Reference: total-switch-delay", referenceId: "total-switch-delay" }, this.references.get("total-switch-delay")]
        ]);

        this.references.set(referenceId, `${result.totalTransferTime.toFixed(9)} s`);
        this.tables.totalTransferTime.appendTotalRow(referenceId, [
            "Total Transfer Time",
            `${result.handshakeTime.toFixed(9)} + ${this.references.get("total-transmission-time")} + ${this.references.get("total-propagation-delay")} + ${this.references.get("total-switch-delay")}`,
            this.references.get(referenceId)
        ]);
    }

    /**
     * Build sum expression string.
     *
     * @param {Array<Object>} rows - Data rows.
     * @param {string} key - Property key.
     * @param {number} digits - Decimal places.
     * @returns {string} Sum expression.
     */
    sumExpression(rows, key, digits) {
        let expression = "0";

        if (rows.length > 0) {
            expression = rows.map(row => this.toFiniteNumber(row[key], 0).toFixed(digits)).join(" + ");
        }

        return expression;
    }

    /**
     * Sum numeric row values.
     *
     * @param {Array<Object>} rows - Data rows.
     * @param {string} key - Property key.
     * @returns {number} Total.
     */
    sum(rows, key) {
        return rows.reduce(
            (total, row) => total + this.toFiniteNumber(row[key], 0),
            0
        );
    }

    /**
     * Convert value to finite number.
     *
     * @param {*} value - Raw value.
     * @param {number} fallback - Fallback value.
     * @returns {number} Number.
     */
    toFiniteNumber(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    /**
     * Convert number to superscript.
     *
     * @param {number} value - Number.
     * @returns {string} Superscript.
     */
    toSuperscript(value) {
        const superscripts = {
            0: "⁰",
            1: "¹",
            2: "²",
            3: "³",
            4: "⁴"
        };

        return superscripts[value] ?? String(value);
    }

    /**
     * Format number for display.
     *
     * @param {number} value - Number.
     * @returns {string} Formatted number.
     */
    format(value) {
        return Number(value).toLocaleString(undefined, {
            maximumFractionDigits: 6
        });
    }

    /**
     * Render topology diagram.
     *
     * @param {Object} result - Calculation result.
     */
    renderDiagram(result) {
        const layout = this.createDiagramLayout(result.linkRows.length);
        const svg = this.elements.diagram;

        Svg.clear(svg);
        Svg.setViewBox(svg, layout.width, layout.height, {
            width: layout.width
        });

        this.drawHost(svg, layout.leftX, layout.nodeY, "A");

        result.linkRows.forEach((link, index) => {
            const x1 = layout.leftX + index * layout.step;
            const x2 = layout.leftX + (index + 1) * layout.step;
            const labelX = (x1 + x2) / 2;

            this.drawLink(svg, x1, layout.nodeY, x2, layout.nodeY);
            this.drawLinkLabel(svg, labelX, layout.nodeY, link.name);

            if (index < result.linkRows.length - 1) {
                this.drawSwitch(svg, x2, layout.nodeY, `Switch ${index + 1}`);
            }
        });

        this.drawHost(svg, layout.rightX, layout.nodeY, "B");
    }

    /**
     * Create diagram layout.
     *
     * @param {number} linkCount - Number of links.
     * @returns {Object} Diagram layout.
     */
    createDiagramLayout(linkCount) {
        const settings = TransferTimeApp.DIAGRAM_SETTINGS;
        const nodeCount = linkCount + 1;
        const width = Math.max(settings.minimumWidth, Math.max(1, nodeCount) * 210);
        const leftX = settings.paddingX;
        const rightX = width - settings.paddingX;
        const step = linkCount > 0 ? (rightX - leftX) / linkCount : 0;

        return {
            width,
            height: settings.height,
            nodeY: settings.nodeY,
            leftX,
            rightX,
            step
        };
    }

    /**
     * Draw one link line.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} x1 - Start X.
     * @param {number} y1 - Start Y.
     * @param {number} x2 - End X.
     * @param {number} y2 - End Y.
     */
    drawLink(svg, x1, y1, x2, y2) {
        Svg.line(svg, x1, y1, x2, y2, "topology-link");
    }

    /**
     * Draw a link label.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} x - X coordinate.
     * @param {number} y - Base Y coordinate.
     * @param {string} label - Label text.
     */
    drawLinkLabel(svg, x, y, label) {
        const settings = TransferTimeApp.DIAGRAM_SETTINGS;

        Svg.text(svg, label, x, y + settings.link.labelOffsetY, "topology-label anchor-middle");
    }

    /**
     * Draw host node.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @param {string} label - Host label.
     */
    drawHost(svg, x, y, label) {
        const settings = TransferTimeApp.DIAGRAM_SETTINGS;

        Svg.circle(svg, x, y, settings.host.radius, "topology-node topology-host");
        Svg.text(svg, label, x, y + 7, "topology-node-label anchor-middle");
    }

    /**
     * Draw switch node.
     *
     * @param {SVGElement} svg - SVG root.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @param {string} label - Switch label.
     */
    drawSwitch(svg, x, y, label) {
        const settings = TransferTimeApp.DIAGRAM_SETTINGS;
        const rectX = x - settings.switch.width / 2;
        const rectY = y - settings.switch.height / 2;

        Svg.rect(svg, rectX, rectY, settings.switch.width, settings.switch.height, "topology-node topology-switch");
        Svg.text(svg, label, x, y + settings.switch.labelOffsetY, "topology-label anchor-middle");
    }

    /**
     * Render summary values.
     *
     * @param {Object} result - Calculation result.
     */
    renderSummary(result) {
        this.elements.summaryCircuitRtt.value = result.circuitRtt.toFixed(9);
        this.elements.summaryTotalTransferTime.value = result.totalTransferTime.toFixed(9);
    }
}

document.addEventListener("DOMContentLoaded", function initializeApplication() {
    new TransferTimeApp();
});
