/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
module.exports = {
	appId: "com.sleer.app",
	productName: "Sleer",
	asar: true,
	directories: {
		output: "dist",
		buildResources: "build",
	},
	files: [
		"electron/**",
		".output/public/**",
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
		"electron/aperture.cjs", // Aperture modülünü ASAR dışında tut
		"node_modules/aperture/**", // Aperture npm modülünü de ASAR dışında tut
		"node_modules/execa/**", // Execa modülünü de ASAR dışında tut (aperture dependency)
		"node_modules/uiohook-napi/**", // UIohook binary'lerini ASAR dışında tut
		"node_modules/get-stream/**", // get-stream modülünü de ASAR dışında tut
		"node_modules/human-signals/**", // human-signals modülünü de ASAR dışında tut
		"node_modules/is-stream/**", // is-stream modülünü de ASAR dışında tut
		"node_modules/merge-stream/**", // merge-stream modülünü de ASAR dışında tut
		"node_modules/npm-run-path/**", // npm-run-path modülünü de ASAR dışında tut
		"node_modules/onetime/**", // onetime modülünü de ASAR dışında tut
		"node_modules/signal-exit/**", // signal-exit modülünü de ASAR dışında tut
		"node_modules/strip-final-newline/**", // strip-final-newline modülünü de ASAR dışında tut
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
			NSCameraUsageDescription:
				"Sleer, ekran kayıtlarınıza kamera görüntünüzü eklemek için kameranıza erişim gerektirir.",
			NSMicrophoneUsageDescription:
				"Sleer, sesli anlatım kaydetmek için mikrofonunuza erişim gerektirir.",
			NSScreenCaptureUsageDescription:
				"Sleer, ekranınızı kaydetmek için bu izne ihtiyaç duyar.",
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
		title: "Sleer Installer",
	},
	// Bağımlılıkları daha iyi derlemek için
	nodeGypRebuild: true,
	npmRebuild: true,
};
