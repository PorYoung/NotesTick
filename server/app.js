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

/* 定义游戏参数 */
// 定义玩家列表
const _playersSet = new Set();
const _playersObj = new Object();
const _readyPlayersSet = new Set();
// 定义默认头像
const defaultAvatar = "/images/avatar.jpg";
// 定义默认音符
const _notesList = ["C1", "D2", "E3", "F4", "G5", "A6", "B7"];

// 静态文件服务
app.use(express.static("public"));

// 连接前检查
io.use((socket, next) => {
	const name = socket.handshake.query.name;

	// 判断用户名是否重复
	if (_playersSet.has(name)) {
		return next(new Error("Username is already taken"));
	}

	// 将新用户名添加到已连接的用户名集合
	_playersSet.add(name);

	// 继续连接
	next();
});

// 客户端连接事件
io.on("connection", (socket) => {
	console.log("A user connected", socket.id);
	const name = socket.handshake.query.name;

	// 生成随机音阶的音符
	const note = generateRandomNote();

	// 添加玩家到列表
	let newPlayer = {
		name,
		id: socket.id,
		avatar: defaultAvatar,
	};

	_playersObj[socket.id] = newPlayer;

	// 将玩家列表发送给所有连接的客户端
	io.emit("updatePlayers", _playersObj);
	io.emit("updateReadyPlayers", [..._readyPlayersSet]);

	// 将音符发送给连接的客户端
	socket.emit("genNote", { id: socket.id, note });

	// 处理连接事件
	socket.on("joinGame", (data) => {
		_readyPlayersSet.add(newPlayer.name);
		console.log(newPlayer.name, _readyPlayersSet);

		io.emit("updateReadyPlayers", [..._readyPlayersSet]);
	});
	socket.on("cancelReady", (data) => {
		_readyPlayersSet.delete(newPlayer.name);
		console.log(newPlayer.name, _readyPlayersSet);

		io.emit("updateReadyPlayers", [..._readyPlayersSet]);
	});

	// 处理按下空格键事件
	socket.on("keydown", (data) => {
		console.log(data);
		// 广播按下空格键事件给所有连接的客户端
		io.emit("playNote", { id: socket.id, note: data.note });
	});

	// 处理释放空格键事件
	socket.on("keyup", (data) => {
		console.log(data);
		// 广播按下空格键事件给所有连接的客户端
		io.emit("stopNote", { id: socket.id, note: data.note });
	});

	// 处理断开连接事件
	socket.on("disconnect", (reason) => {
		console.log("A user disconnected, reason: ", reason, socket.id);

		// 从玩家列表中移除断开连接的玩家
		removeInactiveUser(socket);

		// 将玩家列表发送给所有连接的客户端
		io.emit("updatePlayers", _playersObj);
		io.emit("updateReadyPlayers", _readyPlayersSet);
	});
});

// 移除无效用户
function removeInactiveUser(socket) {
	let user = undefined;
	if (socket.id in _playersObj) {
		user = _playersObj[socket.id];
		delete _playersObj[socket.id];
	}

	if (_playersSet.has(user.name)) {
		_playersSet.delete(user.name);
	}

	if (_readyPlayersSet.has(user.name)) {
		_readyPlayersSet.delete(user.name);
	}

	console.log(user.name, _playersObj, _playersSet, _readyPlayersSet);
}

// 生成随机音阶的音符的函数
function generateRandomNote() {
	// 添加你的生成随机音阶的音符的逻辑
	return _notesList[Math.floor(Math.random() * _notesList.length)];
}
