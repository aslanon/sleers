// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
				ssr: false,
				modules: ["@nuxtjs/tailwindcss"],

				app: {
								baseURL: "/",
								buildAssetsDir: "assets",
								head: {
												title: "Sleer - Ekran Kayıt Uygulaması",
												meta: [
																{ charset: "utf-8" },
																{ name: "viewport", content: "width=device-width, initial-scale=1" },
																{
																				"http-equiv": "Content-Security-Policy",
																				content:
																								"default-src 'self' 'unsafe-inline' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* http://127.0.0.1:*; connect-src 'self' ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*; img-src 'self' data: http://localhost:* http://127.0.0.1:*; style-src 'self' 'unsafe-inline' http://localhost:* http://127.0.0.1:*;",
																},
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