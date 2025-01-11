const { EventEmitter } = require("events");
const addon = require("bindings")("cursor_monitor");

class CursorMonitorWrapper extends EventEmitter {
	constructor() {
		super();
		this.monitor = new addon.CursorMonitor((cursorType) => {
			this.emit("cursor-changed", cursorType);
		});
	}

	start() {
		this.monitor.start();
	}

	stop() {
		this.monitor.stop();
	}
}

module.exports = CursorMonitorWrapper;
