const cursorManager = require("../build/Release/cursor_manager.node");

module.exports = {
	hideCursor: cursorManager.hideCursor,
	showCursor: cursorManager.showCursor,
};
