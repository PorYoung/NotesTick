<!--
  @name: fullScreen.vue
  @date: 2023-08-16
  @version：0.0.1
  @describe: 全屏模式页面
-->

<template>
	<el-container class="main-wrapper">
		<el-header>
			<el-progress :percentage="50" status="exception"></el-progress>
		</el-header>
		<el-main>
			<piano ref="piano" />
		</el-main>
		<el-footer>
            <button
                class="btn"
                @click="toStart"
            >
                开始游戏
            </button>
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
	name: "FullScreen",
	mixins: [CommonMixin, InstrumentsMixin, MidiMixin],
	components: { piano },
	data() {
		return {
			/* 加载 MIDI 文件 */
			midiUrl: "",
			/* Socket 相关变量 */
			socket: null,
			latency: 0,
			/* 音符资源 */
			notesResources: [], // 乐曲涉及的全部音符
			notesRestList: [], // 乐曲中不参与分配的音符
			allocStartPos: 0, // 音符资源中起始被分配的音符的位置
			allocEndPos: 0, // 音符资源中最后被分配的音符的位置
			userNotesMap: {}, // 用户与分配的音符映射
			/* 音符控制相关变量 */
			started: false,
			toStartTime: 3000, // 正式启动倒计时ms
			blankTime: 1000,
			keyboardList: ["a", "s", "d", "f", "j", "k", "l"],
			keyNotesMap: {
				a: "C4",
				s: "D4",
				d: "E4",
				f: "F4",
				j: "G4",
				k: "A4",
				l: "B4",
			},
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
		this.createSocket();
	},
	methods: {
		/* Socket 相关方法 */
		createSocket() {
			// 连接WebSocket服务器
			this.socket = io({
				reconnectionDelayMax: 10000,
				query: {
					name: '111',
					mode: "solo",
					room: "cgb",
				},
			})
			this.name = name;
			// 监听连接事件
			this.socket.on("connect", this.onConnect);
			this.socket.on("connect_error", this.onError);
			this.socket.on("error", this.onError);
			this.socket.on("disconnect", this.onDisConnect);

			// 监听服务资源返回事件
			this.socket.on("SERVER_RESOURCE", this.onResources);

			// 监听播放音符事件
			this.socket.on("SERVER_BROADCAST_NOTE", this.onBroadcastNote);

			// 监听音符释放事件
			this.socket.on("SERVER_RELEASE_NOTE", this.onReleaseNote);

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
		onResources(data) {
			// 返回{ notesResources, notesRestList }
			this.notesResources = data.notesResources;
			this.notesRestList = data.notesRestList;
		},
		onReadyEvent(data) {
			// data: 返回 {userId, readyIds, userNotesMap, allocEndPos}
			this.readyIds = data.readyIds;
			this.userNotesMap = data.userNotesMap;
			this.allocStartPos = data.allocStartPos;
			this.allocEndPos = data.allocEndPos;

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
		},
		onStartEvent(data) {
			this.started = true;
			const notes = this.midiNotes;
			const _toStartTime = this.toStartTime;
			const countFun = () => {
				this.$message.success(`倒计时 ${this.toStartTime / 1000}`);
				this.toStartTime -= 1000;
				if (this.toStartTime > 0) {
					setTimeout(countFun, 1000);
				} else {
					this.toStartTime = _toStartTime;
					// 启动音乐雨
					this.$refs.piano.$emit(
						"startRain",
						notes,
						this.blankTime,
						this.notesResources
					);
					// 播放notes
					this.playCurrentNotesTimer(
						notes,
						this.blankTime,
						this.notesResources.slice(
							this.allocStartPos,
							this.allocEndPos > 0 ? this.allocEndPos + 1 : 0
						)
					);
				}
			};
			countFun();
		},
		/**
		 * 用户准备
		 */
		toReady() {
            // 加载播放环境
            if (!this.instrument) {
                this.loadInstrument("Salamander piano", () => {
                    // 获取midi文件并解析为JSON
                    this.getMidiJson().then((notes) => {
                        notes.forEach((note) => {
                            note.time /= this.vRatio;
                            note.duration /= this.vRatio;
                        });
                        this.midiNotes = notes;

                        // 发送准备事件给服务器
                        this.socket.emit("CLI_READY", { name: this.name });
                    });
                });
            } else {
                // 发送开始事件给服务器
                this.socket.emit("CLI_READY", { name: this.name });
            }
		},
		/**
		 * 开始游戏
		 */
		toStart() {
            this.toReady()
			this.socket.emit("GAME_START", { tickTime: +new Date() });
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
		}
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
