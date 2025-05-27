// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	ssr: false,
	modules: ["@nuxtjs/tailwindcss"],
	tailwindcss: {
		configPath: "~/tailwind.config.js",
		exposeConfig: true,
		injectPosition: 0,
		viewer: true,
	},
	devtools: { enabled: false },

	css: [
		"~/assets/css/fonts.css",
		"~/assets/css/main.css",
		"~/assets/css/scrollbar.css",
	],

	app: {
		baseURL: "/",
		buildAssetsDir: "assets",
		head: {
			title: "Sleer - Ekran Kayıt Uygulaması",
			meta: [
				{ charset: "utf-8" },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
			],
		},
	},

	nitro: {
		preset: "node-server",
		serveStatic: true,
	},

	vite: {
		server: {
			hmr: {
				protocol: "ws",
				host: "localhost",
			},
		},
		build: {
			target: "esnext",
			rollupOptions: {
				external: ["electron"],
				output: {
					format: "es",
				},
			},
		},
		optimizeDeps: {
			exclude: ["electron"],
		},
		resolve: {
			alias: {
				electron: "./electron/electron-shim.js",
			},
		},
	},

	devServer: {
		port: process.env.NUXT_PORT || 3002,
		host: "127.0.0.1",
	},

	router: {
		options: {
			strict: false,
		},
	},

	compatibilityDate: "2024-12-27",
});
