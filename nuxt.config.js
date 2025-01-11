// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	ssr: false,
	modules: ["@nuxtjs/tailwindcss"],
	devtools: { enabled: false },

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
		},
	},

	devServer: {
		port: 3000,
		host: "127.0.0.1",
	},

	router: {
		options: {
			strict: false,
		},
	},

	compatibilityDate: "2024-12-27",
});
