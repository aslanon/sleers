/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
	appId: "com.creavit.studio",
	productName: "Creavit Studio",
	asar: false,
	directories: {
		output: "dist",
		buildResources: "build",
	},
	files: [
		"electron/**",
		"package.json",
		"node_modules/electron-store/**",
		"node_modules/conf/**", 
		"node_modules/@ffmpeg-installer/**",
		"node_modules/fluent-ffmpeg/**",
		"node_modules/node-mac-recorder/**",
		"node_modules/uiohook-napi/**",
		"node_modules/async/**", // fluent-ffmpeg dependency
		"node_modules/which/**", // fluent-ffmpeg dependency
	],
	extraResources: [
		{
			from: ".output/public",
			to: "public",
		},
		{
			from: "node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg",
			to: "ffmpeg",
		},
	],
	extraMetadata: {
		main: "electron/main.cjs",
	},
	mac: {
		category: "public.app-category.video",
		icon: "build/icon.icns",
		target: [
			{
				target: "dir",
				arch: ["arm64"],
			},
			{
				target: "dmg",
				arch: ["arm64"],
			},
		],
		hardenedRuntime: true,
		gatekeeperAssess: false,
		entitlements: "build/entitlements.mac.plist",
		entitlementsInherit: "build/entitlements.mac.plist",
		artifactName: "${productName}-${version}-arm64.${ext}",
		extendInfo: {
			CFBundleDisplayName: "Creavit Studio",
			CFBundleName: "Creavit Studio",
			NSCameraUsageDescription:
				"Creavit Studio, ekran kayıtlarınıza kamera görüntünüzü eklemek için kameranıza erişim gerektirir.",
			NSMicrophoneUsageDescription:
				"Creavit Studio, sesli anlatım kaydetmek için mikrofonunuza erişim gerektirir.",
			NSScreenCaptureUsageDescription:
				"Creavit Studio, ekranınızı kaydetmek için bu izne ihtiyaç duyar.",
		},
	},
	dmg: {
		icon: "build/icon.icns",
		iconSize: 100,
		contents: [
			{
				x: 380,
				y: 170,
				type: "link",
				path: "/Applications",
			},
			{
				x: 130,
				y: 170,
				type: "file",
			},
		],
		window: {
			width: 540,
			height: 380,
		},
		backgroundColor: "#1e293b",
		title: "Creavit Studio Installer",
	},
	// Bağımlılıkları daha iyi derlemek için
	nodeGypRebuild: true,
	npmRebuild: true,
};
