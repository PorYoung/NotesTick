const path = require("path");
const express = require("express");
const app = express();

const http = require("http").createServer(app);
const server = app.listen(3000, function () {
	console.log("server running on port 3000");
});
const io = require("socket.io")(server, {
	cors: {
		origin: "*",
	},
});
const solo = require("./app/solo");

//跨域问题解决方面
const cors = require("cors");
app.use(cors());

Set.prototype.isDuplicate = (obj, key) => {
	for (const item of mySet) {
		if (item[key] === obj[key]) {
			return true;
		}
	}
	return false;
};

Set.prototype.deleteByKey = (key, val) => {
	for (const item of mySet) {
		if (item[key] === val) {
			mySet.delete(item);
			break;
		}
	}
};

// 静态文件服务
app.use("/static", express.static(path.resolve(__dirname, "./static")));
app.use(
	express.static(path.resolve(__dirname, "./public"), { index: "index.html" })
);

// 连接前检查
io.use((socket, next) => {
	solo.preInterceptor(socket, next);
});

// 客户端连接事件
io.on("connection", (socket) => {
	console.log("A user connected", socket.id);
	const { name, mode, room } = socket.handshake.query;

	solo.createSoloEnv(io, socket);
});

// HTTP Server
const midiRouter = require("./app/midi");
app.use("/api", midiRouter);
