const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");

// Create a 512x512 canvas
const canvas = createCanvas(512, 512);
const ctx = canvas.getContext("2d");

// Fill with a background color
ctx.fillStyle = "#3498db"; // A nice blue color
ctx.fillRect(0, 0, 512, 512);

// Draw a circular gradient
const gradient = ctx.createRadialGradient(256, 256, 50, 256, 256, 250);
gradient.addColorStop(0, "#ecf0f1");
gradient.addColorStop(1, "#2980b9");
ctx.fillStyle = gradient;
ctx.arc(256, 256, 200, 0, Math.PI * 2);
ctx.fill();

// Draw a simplified "S" letter for Sleer
ctx.fillStyle = "#ffffff";
ctx.font = "bold 280px Arial";
ctx.textAlign = "center";
ctx.textBaseline = "middle";
ctx.fillText("S", 256, 256);

// Save the image to build/icon.png
const buffer = canvas.toBuffer("image/png");
const iconPath = path.join(__dirname, "..", "build", "icon.png");

fs.writeFileSync(iconPath, buffer);
console.log(`Icon created at: ${iconPath}`);
