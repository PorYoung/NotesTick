const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

/* 定义游戏参数 */
// 定义玩家列表
const _players = [];
const _readyPlayers = [];
// 定义默认头像
const defaultAvatar = "/images/avatar.jpg";
// 定义默认音符
const _notesList = [
	"simple/1 C",
	"simple/2 D",
	"simple/3 E",
	"simple/4 F",
	"simple/5 G",
	"simple/6 A",
	"simple/7 B",
];

// 静态文件服务
app.use(express.static("public"));

// 客户端连接事件
io.on("connection", (socket) => {
	console.log("A user connected");

	// 处理连接事件
	socket.on("joinGame", (data) => {
		// 生成随机音阶的音符
		const note = generateRandomNote();

		// 添加玩家到列表
		_players.push({
			id: socket.id,
			name: data.name,
			avatar: defaultAvatar,
		});

		// 将玩家列表发送给所有连接的客户端
		io.emit("updatePlayers", _players);

		// 将音符发送给连接的客户端
		socket.emit("genNote", { id: socket.id, note });
	});

	// 处理按下空格键事件
	socket.on("keypress", (data) => {
		// 广播按下空格键事件给所有连接的客户端
		io.emit("playNote", { id: socket.id, note: data.note });
	});

	// 处理开始游戏事件
	socket.on("startGame", (data) => {
		// 添加你的开始游戏逻辑
		// 添加玩家到列表
		_readyPlayers.push({ name: data.name });

		// 将玩家列表发送给所有连接的客户端
		io.emit("updateReadyPlayers", _readyPlayers);
	});

	// 处理断开连接事件
	socket.on("disconnect", (socket) => {
		console.log("A user disconnected");

		// 从玩家列表中移除断开连接的玩家
		removeInactiveUser(_players, socket);
		removeInactiveUser(_readyPlayers, socket);

		// 将玩家列表发送给所有连接的客户端
		io.emit("updatePlayers", _players);
	});
});

// 移除无效用户
function removeInactiveUser(players, socket) {
	const index = players.findIndex((player) => player.id === socket.id);
	if (index !== -1) {
		players.splice(index, 1);
	}
}

// 生成随机音阶的音符的函数
function generateRandomNote() {
	// 添加你的生成随机音阶的音符的逻辑
	return _notesList[Math.floor(Math.random() * _notesList.length)];
}

// 启动服务器
const port = 3000;
http.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});
