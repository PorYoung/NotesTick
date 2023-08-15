const config = require("../config");
const tools = require("../utils/tools");
const MidiHelper = require("../utils/midiHelper");

/* 游戏参数 */
// 房间参数配置
const RoomConfigMap = {};
// 当前默认只有一个房间
const ROOM_ID = "cgb";
const DEFAULT_MIDI_NAME = "我爱你中国.mid";
// 房间默认配置
const DEFAULT_CONFIG = {
	maxPeople: 20,
	maxNotesMapNum: 7,
	usersMap: {},
	userIds: [],
	readyIdsSet: new Set(),
	userNotesMap: {},
	allocStartPos: 0,
	allocEndPos: 0,
};
// 用户对象模板
const USER_TEMPLATE = {
	id: "",
	name: "",
	notes: [],
	avatar: config.DEFAULT_AVATAR,
};
// 默认事件名
const SERVER_RESOURCE = "SERVER_RESOURCE";
const USERS_UPDATE = "USERS_UPDATE";
const READY_UPDATE = "READY_UPDATE";
const GAME_START = "GAME_START";
const PING = "PING";
const PONG = "PONG";
const CLI_READY = "CLI_READY";
const CLI_CANCEL_READY = "CLI_CANCEL_READY";
const CLI_BROADCAST_NOTE = "CLI_BROADCAST_NOTE";
const CLI_RELEASE_NOTE = "CLI_RELEASE_NOTE";
const SERVER_BROADCAST_NOTE = "SERVER_BROADCAST_NOTE";
const SERVER_RELEASE_NOTE = "SERVER_RELEASE_NOTE";
const CLI_DISCONNECT = "disconnect";

/* 游戏运行时方法 */
// 创建房间
const createOrGetRoom = (room = ROOM_ID, midiName = DEFAULT_MIDI_NAME) => {
	let roomConfig = RoomConfigMap[room];
	if (!roomConfig) {
		const { midiJson, notes } = MidiHelper.parseMidiFile(DEFAULT_MIDI_NAME);
		const { allocList, countList, restList } = MidiHelper.countNotes(notes);

		roomConfig = Object.assign(
			{},
			{ ...DEFAULT_CONFIG },
			{
				usersMap: {},
				userIds: [],
				readyIdsSet: new Set(),
				userNotesMap: {},
				notesResources: allocList,
				notesCountList: countList,
				notesRestList: restList,
				allocEndPos: 0,
			}
		);
		RoomConfigMap[room] = roomConfig;
	}

	return roomConfig;
};
// 用户准备就绪，为用户设置运行参数
const updateUserRunEnv = (user, ready = true, room = ROOM_ID) => {
	const roomConfig = createOrGetRoom(room);
	const { notesResources, readyIdsSet, userNotesMap, maxNotesMapNum } =
		roomConfig;

	if (ready) {
		// 添加用户到准备队列
		readyIdsSet.add(user.id);
	} else {
		readyIdsSet.delete(user.id);
		delete userNotesMap[user.id];
	}
	const numReady = readyIdsSet.size;
	const numResources = notesResources.length;

	// 计算每个用户应分配的资源数量
	let resourcesPerUser = Math.floor(numResources / numReady);
	resourcesPerUser =
		resourcesPerUser > maxNotesMapNum ? maxNotesMapNum : resourcesPerUser;
	const allocStartPos = Math.floor(
		(numResources - resourcesPerUser * numReady) / 2
	);
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
};
// 移除无效用户
const removeInactiveUser = (id, room = ROOM_ID) => {
	const { readyIdsSet, usersMap } = createOrGetRoom(room);
	if (readyIdsSet.has(id)) {
		updateUserRunEnv({ id }, false, room);
	}
	delete usersMap[id];
};

/* 游戏事件监听 */
/**
 * 连接前校验
 */
const preChecker = (socket, next) => {
	const { name, mode = "solo", room = ROOM_ID } = socket.handshake.query;
	const id = socket.id;
	const { userIds, maxPeople } = createOrGetRoom(room);
	if (userIds.length >= maxPeople) {
		return next(
			new Error("The room is already full, please wait and try again.")
		);
	}
	if (id in userIds) {
		return next(new Error("UserId is already taken!"));
	}
	next();
};
/**
 * 用户连接事件处理
 * @param
 * @param {Socket} socket
 */
const onUserConnect = (io, socket) => {
	const { name, mode = "solo", room = ROOM_ID } = socket.handshake.query;
	const { userIds, usersMap, maxPeople, notesResources, notesRestList } =
		createOrGetRoom(room);
	const id = socket.id;
	const user = Object.assign(USER_TEMPLATE, {
		name,
		id: id,
		avatar: tools.generateAvatar(name),
	});
	userIds.push(id);
	usersMap[id] = user;

	// 广播用户列表更新
	io.emit(USERS_UPDATE, { usersMap });
	// 返回资源列表
	socket.emit(SERVER_RESOURCE, { notesResources, notesRestList });
};
/**
 * 用户准备事件处理
 * @param {Socket} socket
 */
const onUserReady = (io, socket, data) => {
	const { name, mode = "solo", room = ROOM_ID } = socket.handshake.query;
	const roomConfig = createOrGetRoom(room);
	const { usersMap, readyIdsSet, userNotesMap } = roomConfig;

	const id = socket.id;
	updateUserRunEnv(usersMap[id], true);

	// 广播用户准备列表更新和通知用户更新资源
	io.emit(READY_UPDATE, {
		userId: id,
		readyIds: [...readyIdsSet],
		userNotesMap,
		allocStartPos: roomConfig.allocStartPos,
		allocEndPos: roomConfig.allocEndPos,
	});
	console.log(
		room,
		usersMap,
		readyIdsSet,
		userNotesMap,
		roomConfig.allocStartPos,
		roomConfig.allocEndPos
	);
};
/**
 * 用户退出事件
 */
const onUserDisconnect = (io, socket, reason) => {
	console.log("A user disconnected, reason: ", reason, socket.id);

	// 从玩家列表中移除断开连接的玩家
	removeInactiveUser(socket.id);

	// @todo: 根据用户id获取房间信息
	const { usersMap, readyIdsSet, userNotesMap } = RoomConfigMap[ROOM_ID];

	// 将玩家列表发送给所有连接的客户端
	io.emit(USERS_UPDATE, usersMap);
	io.emit(READY_UPDATE, { readyIds: [...readyIdsSet], userNotesMap });
};
/**
 * 用户取消准备事件
 */
const onUserCancelReady = (io, socket, data) => {
	const { name, mode = "solo", room = ROOM_ID } = socket.handshake.query;
	const { readyIdsSet, userNotesMap } = RoomConfigMap[room];
	updateUserRunEnv({ id: socket.id }, false, room);

	// 事件通知
	io.emit(READY_UPDATE, { readyIds: [...readyIdsSet], userNotesMap });
};

/**
 * 游戏开始事件
 */
const onGameStart = (io, socket, data) => {
	const { name, mode = "solo", room = ROOM_ID } = socket.handshake.query;
	const roomConfig = RoomConfigMap[room];
	roomConfig.startTick = +new Date();

	// 事件通知
	io.emit(GAME_START, roomConfig.startTick);
};

/**
 * 音符广播事件
 * @param {*} io
 * @param {*} socket
 * @param {*} data
 */
const onBroadcastNote = (io, socket, data) => {
	const {
		note /* 音符 */,
		tickTime /* 音符在客户端的相对触发时间 */,
		time /* 音符的规定触发时间 */,
		duration /* 音符的规定持续时间 */,
	} = data;

	io.emit(SERVER_BROADCAST_NOTE, {
		userId: socket.id,
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
const onReleaseNote = (io, socket, data) => {
	const {
		note /* 音符 */,
		releaseTime /* 音符在客户端的相对触发时间 */,
		time /* 音符的规定触发时间 */,
		duration /* 音符的规定持续时间 */,
	} = data;

	io.emit(SERVER_RELEASE_NOTE, {
		userId: socket.id,
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
const onPing = (io, socket, { ping }) => {
	socket.emit(PONG, { ping, pong: +new Date() });
};

/* export */
/**
 *
 * @param {Socket} io
 * @param {Socket} socket
 */
const createSoloEnv = (io, socket) => {
	// init
	console.log("onUserConnect");
	onUserConnect(io, socket);

	// 用户准备
	socket.on(CLI_READY, (data) => {
		console.log(CLI_READY);
		onUserReady(io, socket, data);
	});

	// 用户取消准备
	socket.on(CLI_CANCEL_READY, (data) => {
		console.log(CLI_CANCEL_READY);
		onUserCancelReady(io, socket, data);
	});

	// 用户退出
	socket.on(CLI_DISCONNECT, (reason) => {
		console.log(CLI_DISCONNECT);
		onUserDisconnect(io, socket, reason);
	});

	// 开始游戏
	socket.on(GAME_START, (data) => {
		console.log(GAME_START);
		onGameStart(io, socket, data);
	});

	// 播放事件
	socket.on(CLI_BROADCAST_NOTE, (data) => {
		console.log(CLI_BROADCAST_NOTE);
		onBroadcastNote(io, socket, data);
	});

	// 播放停止事件
	socket.on(CLI_RELEASE_NOTE, (data) => {
		console.log(CLI_RELEASE_NOTE);
		onReleaseNote(io, socket, data);
	});

	// 网络检测
	socket.on(PING, (data) => {
		onPing(io, socket, data);
	});
};

module.exports = {
	createSoloEnv,
	preChecker,
};
