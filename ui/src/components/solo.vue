<template>
	<div>
		<button id="start" @click="joinGame">
			{{ readyText }} {{ _len(readyPlayers) }} /
			{{ _len(players) }} 玩家已准备
		</button>
		<div id="players" ref="players" v-for="item in players">
			<div class="player">
				<img src="@static/images/avatar.jpg" />
				<span>{{ item.name }}</span>
			</div>
		</div>
		<audio id="noteAudio" ref="noteAudio"></audio>
	</div>
</template>

<script>
import io from "socket.io-client";
export default {
	name: "Solo",
	data() {
		return {
			socket: null,
			keyLock: false,
			ready: false,
			readyText: "准备",
			players: {
				name: "",
			},
			readyPlayers: [],
			myNote: null,
		};
	},
	mounted() {
		const name = prompt("请输入您的名字");
		// this.players.push({ name });
		if (name) {
			this.createSocket(name);
		}
	},
	methods: {
		_len(o) {
			return o instanceof Array
				? o.length
				: o instanceof Set
				? o.size
				: Object.keys(o).length;
		},
		createSocket(name) {
			// 连接WebSocket服务器
			this.socket = io({
				reconnectionDelayMax: 10000,
				query: {
					name,
				},
			});
			// 监听连接事件
			this.socket.on("connect", this.onConnect);
			this.socket.on("connect_error", this.onError);
			this.socket.on("error", this.onError);
			this.socket.on("disconnect", this.onDisConnect);

			// 监听键盘事件
			this.addKeyDownListener();
			this.addKeyUpListener();

			// 监听播放音符事件
			this.socket.on("genNote", (data) => {
				this.myNote = data.note;
			});

			// 监听播放音符事件
			this.socket.on("playNote", (data) => {
				// 播放音符声音
				this.playSound(data.note);

				// 闪烁头像
				this.blinkAvatar(data.id);
			});

			// 监听用户列表更新事件
			this.socket.on("updatePlayers", this.onUpdatePlayers);

			// 监听准备用户列表更新事件
			this.socket.on("updateReadyPlayers", (data) => {
				console.log(data);
				this.readyPlayers = data;
			});
		},
		onConnect() {
			console.log("Connected to server");
		},
		onError(err) {
			console.error(err);
			alert(err);
		},
		onDisConnect(reason) {
			console.error(reason);
		},
		onUpdatePlayers(data) {
			console.log(data);
			this.updatePlayersList(data);
		},
		joinGame() {
			this.ready = !this.ready;
			this.readyText = this.ready ? "取消准备" : "准备";
			// 发送开始事件给服务器
			this.ready
				? this.socket.emit("joinGame", { name: this.name })
				: this.socket.emit("cancelReady", { name: this.name });
		},
		// 监听键盘事件
		addKeyDownListener() {
			window.addEventListener("keydown", this.onKeyDown);
		},
		addKeyUpListener() {
			window.addEventListener("keyup", this.onKeyUp);
		},
		onKeyDown(e) {
			if (!this.keyLock && e.key == " ") {
				this.keyLock = true;
				this.socket.emit("keydown", { note: this.myNote });
				this.blinkAvatar();
			}
		},
		onKeyUp(e) {
			if (this.keyLock && e.key == " ") {
				this.keyLock = false;
				this.socket.emit("keyup", { note: this.myNote });
			}
		},
		/* 音频处理 */
		// 创建音频元素
		// 播放音符的函数
		playSound(note) {
			console.log("播放音符声音", note);
			const noteAudio = this.$refs.noteAudio;

			// 设置音频源
			noteAudio.src = require(`@static/sound/${note}.mp3`);
			console.log(noteAudio.play);
			// 播放音频
			noteAudio.play();
		},
		// 闪烁头像的函数
		blinkAvatar(id) {
			// 添加你的头像闪烁的逻辑
			console.log("头像闪烁", id);
		},
		// 更新用户列表的函数
		updatePlayersList(data) {
			this.players = data;
		},
	},
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss"></style>
