window.onload = () => {
	let socket = null;
	let keyLock = false;
	let started = false;
	let players = [];
	let myNote = null;
	const name = prompt("请输入您的名字");
	if (name) {
		createSocket(name);
	}

	function createSocket(name) {
		// 连接WebSocket服务器
		socket = io();

		// 监听连接事件
		socket.on("connect", () => {
			console.log("Connected to server");

			// 发送连接事件给服务器
			socket.emit("joinGame", { name });
		});

		// 监听键盘事件
		document.body.addEventListener("keypress", (e) => {
			if (!keyLock && e.key == " ") {
				keyLock = true;
				socket.emit("keypress", { note: myNote });
				blinkAvatar();
				setTimeout(() => {
					keyLock = false;
				}, 100);
			}
		});

		// 监听播放音符事件
		socket.on("genNote", (data) => {
			myNote = data.note;
		});

		// 监听播放音符事件
		socket.on("playNote", (data) => {
			// 播放音符声音
			playSound(data.note);

			// 闪烁头像
			blinkAvatar(data.id);
		});

		// 监听开始按钮点击事件
		document.getElementById("start").addEventListener("click", () => {
			if (started) {
				return;
			}
			started = true;
			// 发送开始事件给服务器
			socket.emit("startGame", { name });
		});

		// 监听用户列表更新事件
		socket.on("updatePlayers", (players) => {
			updatePlayersList(players);
		});

		// 更新用户列表的函数
		function updatePlayersList(incoming) {
			players = incoming;
			const playersDiv = document.getElementById("players");
			playersDiv.innerHTML = "";

			incoming.forEach((player) => {
				const playerDiv = document.createElement("div");
				playerDiv.classList.add("player");

				const avatarImg = document.createElement("img");
				avatarImg.src = player.avatar;
				playerDiv.appendChild(avatarImg);

				const nameSpan = document.createElement("span");
				nameSpan.textContent = player.name;
				playerDiv.appendChild(nameSpan);

				playersDiv.appendChild(playerDiv);
			});
		}

		// 监听准备用户列表更新事件
		socket.on("updateReadyPlayers", (incoming) => {
			console.log(`${incoming.length}/${players.length} 用户已准备`);
		});
	}

	/* 音频处理 */
	// 创建音频元素
	// 播放音符的函数
	function playSound(note) {
		console.log("播放音符声音", note);
		const noteAudio = document.getElementById("noteAudio");

		// 设置音频源
		noteAudio.src = `/sound/${note}.mp3`;

		// 播放音频
		noteAudio.play();
	}

	// 闪烁头像的函数
	function blinkAvatar(id) {
		// 添加你的头像闪烁的逻辑
		console.log("头像闪烁", id);
	}
};
