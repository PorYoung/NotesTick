const logger = require("debug")("app:solo");
const config = require("../config");
const tools = require("../utils/tools");
const MidiHelper = require("../utils/midiHelper");

/* 游戏参数 */
// 房间参数配置
const RoomConfigMap = new Map();
// 当前默认只有一个房间
const ROOM_ID = "cgb";
const DEFAULT_MIDI_NAME = "我爱你中国.mid";
// 房间默认配置
const DEFAULT_CONFIG = {
	maxPeople: 20,
	maxNotesMapNum: 7,
	usersMap: {},
	readyIdsSet: new Set(),
	userNotesMap: {},
	allocStartPos: 0,
	allocEndPos: 0,
	started: false,
	creator: tools.generateUniqueId("admin"),
	midiName: DEFAULT_MIDI_NAME,
	vRatio: 0.75,
	allAuto: false,
};
// 用户对象模板
const USER_TEMPLATE = {
	id: "",
	name: "",
	room: "",
	notes: [],
	avatar: config.DEFAULT_AVATAR,
};
// 默认事件名
const SERVER_RESOURCE = "SERVER_RESOURCE";
const USERS_UPDATE = "USERS_UPDATE";
const READY_UPDATE = "READY_UPDATE";
const GAME_START = "GAME_START";
const GAME_OVER = "GAME_OVER";
const PING = "PING";
const PONG = "PONG";
const CLI_READY = "CLI_READY";
const CLI_CANCEL_READY = "CLI_CANCEL_READY";
const CLI_BROADCAST_NOTE = "CLI_BROADCAST_NOTE";
const CLI_RELEASE_NOTE = "CLI_RELEASE_NOTE";
const SERVER_BROADCAST_NOTE = "SERVER_BROADCAST_NOTE";
const SERVER_RELEASE_NOTE = "SERVER_RELEASE_NOTE";
const SERVER_TO_DISCONNECT = "SERVER_TO_DISCONNECT";
const CLI_DISCONNECTING = "disconnecting";
const CLI_DISCONNECT = "disconnect";

/**
 * 连接预拦截器
 */
const preInterceptor = (socket, next) => {
	const { name, mode = "solo", room } = socket.handshake.query;
	logger(socket.handshake.query);

	// 参数校验
	if (!name || !mode || !room) {
		return next(new Error("Required params haven't been provided."));
	}

	const id = tools.generateUniqueId(name);
	const { usersMap, maxPeople, started, creator } = createOrGetRoom(room);
	const userIds = Object.keys(usersMap);

	// 房间管理员校验
	if (id !== creator && !userIds.includes(creator)) {
		return next(
			new Error(
				"The room is not ready, please wait the admin to create a new room."
			)
		);
	}

	// 房间人数校验
	if (userIds.length >= maxPeople) {
		return next(
			new Error("The room is already full, please wait and try again.")
		);
	}

	// 用户名唯一性校验
	logger("@preInterceptor", id, userIds);
	if (userIds.includes(id)) {
		return next(new Error("UserId is already taken!"));
	}

	// 房间游戏状态校验
	if (started) {
		return next(
			new Error("The game is already started, please wait and try again.")
		);
	}

	next();
};
/**
 * 公共拦截器
 * @param {*} io
 * @param {*} socket
 * @param {*} next
 * @returns
 */
const commonInterceptor = (
	io,
	socket,
	next,
	FUN = { name: "AnonymousFun" }
) => {
	const { name, mode = "solo", room } = socket.handshake.query;
	const roomConfig = RoomConfigMap.get(room);
	if (!roomConfig) {
		// @bug: 事件无法发送
		// socket.emit(SERVER_TO_DISCONNECT, { errMsg: `房间 ${room} 不存在.` });
		// socket.disconnect();

		logger("@commonInterceptor", `next handler name: @${FUN.name}`);
		return null;
	}
	typeof next === "function" && next(roomConfig);
};

/* 游戏事件监听 */
/**
 * 用户连接事件处理
 * @param
 * @param {Socket} socket
 */
const onUserConnect = (io, socket, roomConfig) => {
	const {
		name,
		mode = "solo",
		room,
		midiName,
		vRatio,
		allAuto,
	} = socket.handshake.query;
	const { usersMap, maxPeople, notesResources, readyIdsSet } = roomConfig;
	const id = tools.generateUniqueId(name);
	const user = {
		...USER_TEMPLATE,
		...{
			name,
			room,
			id: id,
			avatar: tools.generateAvatar(name),
		},
	};
	usersMap[id] = user;
	// 加入房间
	socket.join(room);
	// 广播用户列表更新
	io.to(room).emit(USERS_UPDATE, { usersMap });
	// 返回资源列表
	socket.emit(SERVER_RESOURCE, {
		userId: id,
		...roomConfig,
		readyIds: [...readyIdsSet],
	});
	// 判断是否是管理员
	if (id === roomConfig.creator) {
		roomConfig.midiName = midiName || roomConfig.midiName;
		roomConfig.vRatio = vRatio || roomConfig.vRatio;
		roomConfig.allAuto = allAuto === "true" || roomConfig.allAuto;
		io.to(room).emit(SERVER_RESOURCE, {
			userId: id,
			type: "UPDATE",
			...roomConfig,
			readyIds: [...readyIdsSet],
		});
	}
};
/**
 * 用户准备事件处理
 * @param {Socket} socket
 */
const onUserReady = (io, socket, roomConfig, data) => {
	const { name, mode = "solo", room } = socket.handshake.query;
	const { usersMap, readyIdsSet, userNotesMap } = roomConfig;
	const id = tools.generateUniqueId(name);
	updateUserRunEnv(socket, roomConfig, usersMap[id], true);

	// 广播用户准备列表更新和通知用户更新资源
	io.to(room).emit(READY_UPDATE, {
		userId: id,
		readyIds: [...readyIdsSet],
		userNotesMap,
		allocStartPos: roomConfig.allocStartPos,
		allocEndPos: roomConfig.allocEndPos,
	});
	logger(
		"@onUserReady",
		"广播用户准备列表更新和通知用户更新资源：",
		room,
		usersMap,
		readyIdsSet,
		userNotesMap,
		roomConfig.allocStartPos,
		roomConfig.allocEndPos
	);
};
/**
 * 用户取消准备事件
 */
const onUserCancelReady = (io, socket, roomConfig, data) => {
	const { name, mode = "solo", room } = socket.handshake.query;
	const { readyIdsSet, userNotesMap } = roomConfig;
	updateUserRunEnv(
		socket,
		roomConfig,
		{ id: tools.generateUniqueId(name) },
		false,
		room
	);

	// 事件通知
	io.to(room).emit(READY_UPDATE, {
		readyIds: [...readyIdsSet],
		userNotesMap,
	});
};
/**
 * 用户退出事件
 */
const onUserDisconnecting = (io, socket, roomConfig, reason) => {
	const { name, mode = "solo", room } = socket.handshake.query;
	const { usersMap, readyIdsSet, userNotesMap, creator } = roomConfig;
	const numReady = readyIdsSet.size;
	const id = tools.generateUniqueId(name);
	// 判断是否是管理员离开，离开则重置游戏
	if (id === creator) {
		logger("@onUserDisconnecting", `reset room ${room}`);
		resetRoom(room);
		// @bug: 事件无法发送
		// io.to(room).emit(SERVER_TO_DISCONNECT, `管理员关闭了房间 ${room}.`);
		io.in(room).disconnectSockets();
		return;
	}

	// 从玩家列表中移除断开连接的玩家
	removeInactiveUser(socket, id, roomConfig);
	// 将玩家列表发送给所有连接的客户端
	io.to(room).emit(USERS_UPDATE, { usersMap });
	// 如果准备队列有变化，将更新列表广播
	numReady != readyIdsSet.size &&
		io.to(room).emit(READY_UPDATE, {
			readyIds: [...readyIdsSet],
			userNotesMap,
		});
	logger("@onUserDisconnecting", id, usersMap, readyIdsSet);
};
const onUserDisconnect = (io, socket, roomConfig, reason) => {
	console.log("A user disconnected, reason: ", reason, socket.id);
};

/**
 * 游戏开始事件
 */
const onGameStart = (io, socket, roomConfig, data) => {
	const { name, mode = "solo", room } = socket.handshake.query;
	roomConfig.startTick = +new Date();

	// @todo 所有用户加载进度同步

	roomConfig.started = true;

	// 事件通知
	io.to(room).emit(GAME_START, roomConfig.startTick);
};

const onGameOver = (io, socket, roomConfig, data) => {
	const { name, mode = "solo", room } = socket.handshake.query;
	roomConfig.stopTick = +new Date();
	roomConfig.started = false;

	// 事件通知
	io.to(room).emit(GAME_OVER, roomConfig.stopTick);
};

/**
 * 音符广播事件
 * @param {*} io
 * @param {*} socket
 * @param {*} data
 */
const onBroadcastNote = (io, socket, roomConfig, data) => {
	const { name, mode = "solo", room } = socket.handshake.query;
	const {
		userId,
		note /* 音符 */,
		tickTime /* 音符在客户端的相对触发时间 */,
		time /* 音符的规定触发时间 */,
		duration /* 音符的规定持续时间 */,
	} = data;

	io.to(room).emit(SERVER_BROADCAST_NOTE, {
		userId,
		note,
		tickTime,
		time,
		timestamp: +new Date(),
	});
};

/**
 * 音符释放广播事件
 * @param {*} io
 * @param {*} socket
 * @param {*} data
 */
const onReleaseNote = (io, socket, roomConfig, data) => {
	const { name, mode = "solo", room } = socket.handshake.query;
	const {
		userId,
		note /* 音符 */,
		releaseTime /* 音符在客户端的相对触发时间 */,
		time /* 音符的规定触发时间 */,
		duration /* 音符的规定持续时间 */,
	} = data;

	io.to(room).emit(SERVER_RELEASE_NOTE, {
		userId,
		note,
		releaseTime,
		time,
		duration,
		timestamp: +new Date(),
	});
};

/**
 * 网络检测
 */
const onPing = (io, socket, roomConfig, { ping }) => {
	socket.emit(PONG, { ping, pong: +new Date() });
};

/* 游戏运行时方法 */
/**
 * 创建房间
 * @param {*} room
 * @param {*} midiName
 * @returns
 * @todo 根据前端参数创建房间
 */
const createOrGetRoom = (room, midiName = DEFAULT_MIDI_NAME) => {
	let roomConfig = RoomConfigMap.get(room);
	if (!roomConfig) {
		const { midiJson, notes } = MidiHelper.parseMidiFile(DEFAULT_MIDI_NAME);
		const { allocList, countList, restList } = MidiHelper.countNotes(notes);

		roomConfig = {
			...DEFAULT_CONFIG,
			...{
				usersMap: {},
				readyIdsSet: new Set(),
				userNotesMap: {},
				notesResources: allocList,
				notesCountList: countList,
				notesRestList: restList,
				allocEndPos: 0,
			},
		};
		RoomConfigMap.set(room, roomConfig);
	}

	return roomConfig;
};
/**
 * 重置房间
 * @param {*} room
 * @returns
 */
const resetRoom = (socket, room) => {
	RoomConfigMap.delete(room);
	// @todo: 重新启动房间
};
/**
 * 用户准备准备状态变更，为用户设置运行参数
 *
 * @param {*} user
 * @param {*} ready
 * @param {*} room
 */
const updateUserRunEnv = (socket, roomConfig, user, ready = true) => {
	const {
		notesResources,
		readyIdsSet,
		userNotesMap,
		maxNotesMapNum,
		allAuto,
	} = roomConfig;

	if (ready) {
		// 添加用户到准备队列
		readyIdsSet.add(user.id);
	} else {
		// 从准备队列中删除用户
		readyIdsSet.delete(user.id);
		delete userNotesMap[user.id];
	}
	const numReady = readyIdsSet.size;
	const numResources = notesResources.length;

	// 计算每个用户应分配的资源数量
	if (allAuto) {
		readyIdsSet.forEach((userId) => {
			userNotesMap[userId] = [];
		});
		roomConfig.allocStartPos = 0;
		roomConfig.allocEndPos = 0;
	} else {
		let resourcesPerUser = Math.floor(numResources / numReady);
		resourcesPerUser =
			resourcesPerUser > maxNotesMapNum
				? maxNotesMapNum
				: resourcesPerUser;
		const allocStartPos = Math.floor(
			(numResources - resourcesPerUser * numReady) / 2
		);
		logger("@updateUserRunEnv", "numResources", numResources);

		// 分配资源给每个准备的用户
		let endPos = 0;
		let loopIdx = 0;
		readyIdsSet.forEach((userId) => {
			// 获取当前用户应分配的资源范围
			let i = loopIdx;
			const start = allocStartPos + i * resourcesPerUser;
			const end = allocStartPos + (i + 1) * resourcesPerUser;
			// 将资源分配给当前用户
			userNotesMap[userId] = notesResources.slice(start, end);
			// 记录最后被分配的音符位置
			endPos = end;
			loopIdx += 1;
		});
		roomConfig.allocStartPos = allocStartPos;
		roomConfig.allocEndPos = endPos;
		logger("@updateUserRunEnv", "roomConfig", roomConfig);
	}
};
// 移除无效用户
const removeInactiveUser = (socket, id, roomConfig) => {
	const { readyIdsSet, usersMap } = roomConfig;
	if (readyIdsSet.has(id)) {
		updateUserRunEnv(socket, roomConfig, { id }, false);
	}
	delete usersMap[id];
};

/* export */
/**
 *
 * @param {Socket} io
 * @param {Socket} socket
 */
const createSoloEnv = (io, socket) => {
	// init
	commonInterceptor(
		io,
		socket,
		(roomConfig) => {
			logger("onUserConnect");
			onUserConnect(io, socket, roomConfig);
		},
		onUserConnect
	);

	// 用户准备
	socket.on(CLI_READY, (data) => {
		logger(CLI_READY);
		commonInterceptor(
			io,
			socket,
			(roomConfig) => {
				onUserReady(io, socket, roomConfig, data);
			},
			onUserReady
		);
	});

	// 用户取消准备
	socket.on(CLI_CANCEL_READY, (data) => {
		logger(CLI_CANCEL_READY);
		commonInterceptor(
			io,
			socket,
			(roomConfig) => {
				onUserCancelReady(io, socket, roomConfig, data);
			},
			onUserCancelReady
		);
	});

	// 用户退出
	socket.on(CLI_DISCONNECTING, (reason) => {
		logger(CLI_DISCONNECTING);
		commonInterceptor(
			io,
			socket,
			(roomConfig) => {
				onUserDisconnecting(io, socket, roomConfig, reason);
			},
			onUserDisconnecting
		);
	});
	socket.on(CLI_DISCONNECT, (reason) => {
		logger(CLI_DISCONNECT);
		commonInterceptor(
			io,
			socket,
			(roomConfig) => {
				onUserDisconnect(io, socket, roomConfig, reason);
			},
			onUserDisconnect
		);
	});

	// 开始游戏
	socket.on(GAME_START, (data) => {
		logger(GAME_START);
		commonInterceptor(
			io,
			socket,
			(roomConfig) => {
				onGameStart(io, socket, roomConfig, data);
			},
			onGameStart
		);
	});

	// 播放事件
	socket.on(CLI_BROADCAST_NOTE, (data) => {
		logger(CLI_BROADCAST_NOTE);
		commonInterceptor(
			io,
			socket,
			(roomConfig) => {
				onBroadcastNote(io, socket, data, roomConfig);
			},
			onBroadcastNote
		);
	});

	// 播放停止事件
	socket.on(CLI_RELEASE_NOTE, (data) => {
		logger(CLI_RELEASE_NOTE);
		commonInterceptor(
			io,
			socket,
			(roomConfig) => {
				onReleaseNote(io, socket, data, roomConfig);
			},
			onReleaseNote
		);
	});

	// 网络检测
	socket.on(PING, (data) => {
		commonInterceptor(
			io,
			socket,
			(roomConfig) => {
				onPing(io, socket, roomConfig, data);
			},
			onPing
		);
	});
};

module.exports = {
	createSoloEnv,
	preInterceptor,
};
