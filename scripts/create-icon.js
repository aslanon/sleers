const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

async function createIcons() {
	try {
		// Load the new logo
		const logoPath = path.join(__dirname, "..", "assets", "new logo", "logo-bg.png");
		const logo = await loadImage(logoPath);
		
		console.log(`Loading logo from: ${logoPath}`);
		
		// Icon sizes to generate
		const sizes = [16, 32, 64, 128, 256, 512, 1024];
		
		for (const size of sizes) {
			// Create canvas for this size
			const canvas = createCanvas(size, size);
			const ctx = canvas.getContext("2d");
			
			// Draw logo centered and scaled
			ctx.drawImage(logo, 0, 0, size, size);
			
			// Save the image
			const buffer = canvas.toBuffer("image/png");
			const iconPath = path.join(__dirname, "..", "build", `icon_${size}x${size}.png`);
			fs.writeFileSync(iconPath, buffer);
			console.log(`Icon created: ${size}x${size}`);
		}
		
		// Create main icon.png (512x512)
		const mainCanvas = createCanvas(512, 512);
		const mainCtx = mainCanvas.getContext("2d");
		mainCtx.drawImage(logo, 0, 0, 512, 512);
		const mainBuffer = mainCanvas.toBuffer("image/png");
		const mainIconPath = path.join(__dirname, "..", "build", "icon.png");
		fs.writeFileSync(mainIconPath, mainBuffer);
		console.log(`Main icon created at: ${mainIconPath}`);
		
	} catch (error) {
		console.error("Error creating icons:", error);
	}
}

createIcons();
