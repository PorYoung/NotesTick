<!--
  @name: solo.vue
  @date: 2023-08-12
  @version：0.0.1
  @describe: 合奏模式页面
-->

<template>
	<el-container v-loading.fullscreen.lock="preloading" class="main-wrapper">
		<el-header>
			<el-progress :percentage="50" status="exception"></el-progress>
		</el-header>
		<el-main>
			<piano ref="piano" />
		</el-main>
		<el-footer>
			<button id="start" @click="toReady">
				{{ readyText }} {{ _len(readyIds) }} /
				{{ _len(usersMap) }} 玩家已准备 &nbsp;[网络延迟:
				{{ latency }} ms]
			</button>
			<div id="usersMap" ref="usersMap" v-for="item in usersMap">
				<div class="player">
					<img src="@static/images/avatar.jpg" />
					<span>{{ item.name }}</span>
				</div>
			</div>
		</el-footer>
	</el-container>
</template>

<script>
import io from "socket.io-client";
import piano from "./piano.vue";
import CommonMixin from "@/mixins/common";
import InstrumentsMixin from "@/mixins/instruments";
import MidiMixin from "@/mixins/midi";
export default {
	name: "Solo",
	mixins: [CommonMixin, InstrumentsMixin, MidiMixin],
	components: { piano },
	data() {
		return {
			/* 页面参数 */
			preloading: true,
			/* 加载 MIDI 文件 */
			midiUrl: "",
			/* Socket 相关变量 */
			socket: null,
			latency: 0,
			/* 音符资源 */
			notesResources: [], // 乐曲涉及的全部音符
			notesRestList: [], // 乐曲中不参与分配的音符
			allocEndPos: 0, // 音符资源中最后被分配的音符的位置
			userNotesMap: {}, // 用户与分配的音符映射
			/* 音符控制相关变量 */
			blankTime: 1000,
			keyboardList: ["a", "s", "d", "f", "j", "k", "l"],
			keyNotesMap: { a: "C4", s: "D4", d: "E4", f: "F4" },
			keyPressed: new Set(),
			keyLock: false,
			ready: false,
			readyText: "准备",
			startTime: "",
			/* 用户相关变量 */
			userId: "",
			name: "",
			usersMap: {
				name: "",
			},
			readyIds: [],
			myNote: null,
			/* 音符雨 */
		};
	},
	mounted() {
		const name = prompt("请输入您的名字");
		this.preloading = false;
		if (name) {
			this.createSocket(name);
		}
	},
	methods: {
		/* Socket 相关方法 */
		createSocket(name) {
			// 连接WebSocket服务器
			this.socket = io({
				reconnectionDelayMax: 10000,
				query: {
					name,
					mode: "solo",
					room: "cgb",
				},
			});
			this.name = name;
			// 监听连接事件
			this.socket.on("connect", this.onConnect);
			this.socket.on("connect_error", this.onError);
			this.socket.on("error", this.onError);
			this.socket.on("disconnect", this.onDisConnect);

			// 监听键盘事件
			this.addKeyDownListener();
			this.addKeyUpListener();

			// 监听服务资源返回事件
			this.socket.on("SERVER_RESOURCE", this.onResources);

			// 监听播放音符事件
			this.socket.on("SERVER_BROADCAST_NOTE", this.onBroadcastNote);

			// 监听音符释放事件
			this.socket.on("SERVER_RELEASE_NOTE", this.onReleaseNote);

			// 监听用户列表更新事件
			this.socket.on("USERS_UPDATE", this.onUpdatePlayers);

			// 监听用户准备列表更新事件
			this.socket.on("READY_UPDATE", this.onReadyUpdate);

			// 网络延迟检测
			const pingTimer = () => {
				this.socket.emit("PING", { ping: +new Date() });
				setTimeout(pingTimer, 1000);
			};
			pingTimer();
			this.socket.on("PONG", ({ ping, pong }) => {
				this.latency = pong - ping;
			});
		},
		onConnect() {
			console.log("Connected to server");
			this.userId = this.socket.id;
		},
		onError(err) {
			console.error(err);
			alert(err);
			this.$router.replace("/home");
		},
		onDisConnect(reason) {
			console.error(reason);
		},
		onUpdatePlayers(data) {
			console.log(data);
			this.updatePlayersList(data.usersMap);
		},
		onResources(data) {
			// 返回{ notesResources, notesRestList }
			this.notesResources = data.notesResources;
			this.notesRestList = data.notesRestList;
		},
		onReadyUpdate(data) {
			// data: 返回 {userId, readyIds, userNotesMap, allocEndPos}
			this.readyIds = data.readyIds;
			this.userNotesMap = data.userNotesMap;
			this.allocEndPos = data.allocEndPos;

			console.log(data);

			if (this.userId === data.userId) {
				// 创建键盘映射
				const notes = this.userNotesMap[this.userId] || [];
				const keyNotesMap = {};
				notes.forEach((note, index) => {
					keyNotesMap[this.keyboardList[index]] = note;
				});
				this.keyNotesMap = keyNotesMap;
			}
		},
		onBroadcastNote(data) {
			// {
			//     note /* 音符 */,
			//     tickTime /* 音符在客户端的相对触发时间 */,
			//     time /* 音符的规定触发时间 */,
			//     duration /* 音符的规定持续时间 */,
			// }
			if (data.userId === this.socket.id) return;

			// 播放音符声音
			this.playSound(data.note);

			// 闪烁头像
			this.blinkAvatar(data.userId);
		},
		onReleaseNote(data) {
			// {
			//     note /* 音符 */,
			//     releaseTime /* 音符在客户端的相对触发时间 */,
			//     time /* 音符的规定触发时间 */,
			//     duration /* 音符的规定持续时间 */,
			// }
			if (data.userId === this.socket.id) return;

			// 播放音符声音
			this.stopSound(data.note);

			// 闪烁头像
			this.blinkAvatar(data.id);
		},
		/**
		 * 用户准备
		 */
		toReady() {
			this.ready = !this.ready;
			this.readyText = this.ready ? "取消准备" : "准备";
			if (this.ready) {
				// 显示加载动画
				this.preloading = true;
				// 加载播放环境
				if (!this.instrument) {
					this.loadInstrument("Salamander piano", () => {
						// 获取midi文件并解析为JSON
						this.getMidiJson().then((notes) => {
							notes.forEach((note) => {
								note.time /= this.vRatio;
								note.duration /= this.vRatio;
							});
							// 启动音乐雨
							this.$refs.piano.$emit(
								"startRain",
								notes,
								this.blankTime
							);
							// setTimeout(() => {
							// 播放notes
							this.playCurrentNotesTimer(notes, this.blankTime);
							// }, 2550);
						});
						// 结束加载动画
						this.preloading = false;
						return;

						// 发送开始事件给服务器
						this.socket.emit("CLI_READY", { name: this.name });
					});
				} else {
					// 结束加载动画
					this.preloading = false;
					// 发送开始事件给服务器
					this.socket.emit("CLI_READY", { name: this.name });
				}
			}
			if (!this.ready) {
				this.socket.emit("CLI_CANCEL_READY", { name: this.name });
			}
		},
		// 监听键盘事件
		addKeyDownListener() {
			window.addEventListener("keydown", this.onKeyDown);
		},
		addKeyUpListener() {
			window.addEventListener("keyup", this.onKeyUp);
		},
		onKeyDown(e) {
			e.preventDefault();
			if (!this.ready || !this.instrument) return;

			if (e.key in this.keyNotesMap && !this.keyPressed.has(e.key)) {
				const note = this.keyNotesMap[e.key];
				this.keyPressed.add(e.key);
				this.instrument.triggerAttack(note);

				this.socket.emit("CLI_BROADCAST_NOTE", {
					note,
					tickTime: +new Date() - this.startTime,
				});
				this.blinkAvatar();
			}
		},
		onKeyUp(e) {
			e.preventDefault();

			if (!this.ready || !this.instrument) return;

			if (e.key in this.keyNotesMap && this.keyPressed.has(e.key)) {
				const note = this.keyNotesMap[e.key];
				this.keyPressed.delete(e.key);
				this.instrument.triggerRelease(this.keyNotesMap[e.key]);

				this.socket.emit("CLI_RELEASE_NOTE", {
					note,
					releaseTime: +new Date() - this.startTime,
				});
			}
		},
		/* 音频处理 */
		// 创建音频元素
		// 播放音符的函数
		playSound(note) {
			console.log("播放音符声音", note);
			this.instrument.triggerAttack(note);
		},
		stopSound(note) {
			this.instrument.triggerRelease(note);
		},
		// 闪烁头像的函数
		blinkAvatar(id) {
			// 添加你的头像闪烁的逻辑
			console.log("头像闪烁", id);
		},
		// 更新用户列表的函数
		updatePlayersList(data) {
			this.usersMap = data;
		},
	},
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
.el-container {
	overflow: hidden;
	height: 100vh !important;
}
.el-header {
	height: 10vh !important;
}
.el-main {
	height: 70vh !important;
}
.el-footer {
	height: 30vh !important;
}
</style>
