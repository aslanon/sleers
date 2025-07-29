/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
	appId: "com.creavit.studio",
	productName: "Creavit Studio",
	asar: true,
	directories: {
		output: "dist",
		buildResources: "build",
	},
	files: [
		"electron/**",
		"package.json",
		"node_modules/electron-store/**", // Electron-store modülünü açıkça dahil et
		"node_modules/conf/**", // conf modülü (electron-store bağımlılığı)
	],
	extraResources: [
		{
			from: ".output/public",
			to: "public",
		},
	],
	extraMetadata: {
		main: "electron/main.cjs",
	},
	// Harici bağımlılıkları asar içine dahil etme
	asarUnpack: [
		"node_modules/electron-store/**",
		"node_modules/conf/**",
		"node_modules/uiohook-napi/**", // UIohook binary'lerini ASAR dışında tut
		"node_modules/node-mac-recorder/**", // MacRecorder native modülünü ASAR dışında tut
	],
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
