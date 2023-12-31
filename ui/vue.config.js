const path = require("path");

let httpServer = `http://${process.env.API_HOST}`;
let wsServer = `ws://${process.env.API_HOST}`;
module.exports = {
	publicPath: process.env.NODE_ENV === "production" ? "/app/" : "/",
	devServer: {
		proxy: {
			"/api": {
				target: httpServer,
				changeOrigin: true,
				pathRewrite: {
					"^/api": "/api",
				},
			},
			"/static": {
				target: httpServer,
				changeOrigin: true,
			},
			"/socket.io": {
				target: wsServer,
				ws: true,
				changeOrigin: true,
			},
		},
	},
	configureWebpack: {
		resolve: {
			alias: {
				"@static": path.resolve(__dirname, "static"),
			},
		},
	},
	css: {
		loaderOptions: {
			sass: {
				prependData: `@import "@/styles/_public.scss";`,
			},
		},
	},
};
