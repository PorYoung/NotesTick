<!--
  @name: solo-hint.vue
  @date: 2023-08-12
  @version：0.0.1
  @describe: 合奏模式页面
-->

<template>
	<el-container v-loading.fullscreen.lock="preloading" class="main-wrapper">
		<el-header>
			<el-progress
				:percentage="progress"
				status="exception"
			></el-progress>
		</el-header>
		<el-main>
			<piano-hint ref="piano" />
		</el-main>
		<el-footer>
			<el-row :gutter="2">
				<el-col :span="6">
					<button
						class="btn"
						:disabled="this.started"
						@click="toReady"
					>
						{{ this.started ? "游戏已开始" : readyText }}
					</button>
				</el-col>
				<el-col :span="6">
					<button
						class="btn"
						:disabled="
							this.started ||
							!this.ready ||
							this.userId !== this.roomCreator
						"
						@click="toStart"
					>
						{{
							this.userId === this.roomCreator
								? `开始游戏 (${_len(readyIds)}
						/ ${_len(usersMap)} 玩家已准备)`
								: "等待游戏开始"
						}}
					</button>
				</el-col>
				<el-col :span="6"> 网络延迟:{{ latency }} ms </el-col>
				<el-col :span="6">
					<button
						class="btn"
						@click="handlePlay"
						:disabled="this.userId !== this.roomCreator"
					>
						{{ this.isPlay ? "暂停" : "播放" }}
					</button>
				</el-col>
			</el-row>

			<el-row ref="usersMap" :gutter="1" type="flex">
				<el-col
					:span="3"
					:key="item.id"
					v-for="item in usersMap"
					class="player"
				>
					<img src="@static/images/avatar.jpg" />
					<span>{{ item.name }}</span>
				</el-col>
			</el-row>
		</el-footer>
		<!-- 全屏对话框 -->
		<el-dialog
			title="提示"
			:visible.sync="dialogVisible"
			:close-on-click-modal="false"
			:close-on-press-escape="false"
			:show-close="false"
			:center="true"
			:before-close="() => {}"
			width="30%"
		>
			<el-form>
				<el-form-item>
					<el-input placeholder="如：admin" v-model="name">
						<template slot="prepend">请输入您的名字</template>
					</el-input>
				</el-form-item>
			</el-form>
			<span slot="footer" class="dialog-footer">
				<el-button type="primary" @click="confirmInputName"
					>确 定</el-button
				>
			</span>
		</el-dialog>
		<div class="logo-rain" v-if="finished">
			<img src="@static/images/cgb.png" class="logo-rain-item" />
			<img src="@static/images/cgb.png" class="logo-rain-item" />
			<h2 class="animate__animated animate__zoomIn">✨🎉音乐完成✨🎉</h2>
		</div>
	</el-container>
</template>

<script>
import io from "socket.io-client";
import PianoHint from "./piano-hint.vue";
import CommonMixin from "@/mixins/common";
import InstrumentsMixin from "@/mixins/instruments";
import MidiMixin from "@/mixins/midi";
import animate from "animate.css";
export default {
	name: "SoloHint",
	mixins: [CommonMixin, InstrumentsMixin, MidiMixin],
	components: { PianoHint },
	data() {
		return {
			/* 页面参数 */
			preloading: true,
			dialogVisible: true,
			/* 加载 MIDI 文件 */
			midiName: "我爱你中国.mid",
			/* Socket 相关变量 */
			socket: null,
			latency: 0,
			roomCreator: "",
			room: "cgb",
			/* 音符资源 */
			notesResources: [], // 乐曲涉及的全部音符
			allocStartPos: 0, // 音符资源中起始被分配的音符的位置
			allocEndPos: 0, // 音符资源中最后被分配的音符的位置
			userNotesMap: {}, // 用户与分配的音符映射
			/* 音符控制相关变量 */
			allAuto: false,
			loadedServerResources: false,
			started: false,
			finished: false,
			maxKeys: 6,
			toStartTime: 3000, // 正式启动倒计时ms
			blankTime: 1000,
			keyboardList: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
			keyNotesMap: {},
			noteKeysMap: {},
			keyPressed: new Set(),
			keyLock: false,
			ready: false,
			readyText: "点我准备 ",
			startTime: "",
			progress: 0,
			releasedIdx: -1, // midi notes中已经播放完成的音符索引
			pausedIdx: -1,
			/* 用户相关变量 */
			userId: "",
			name: "",
			usersMap: {
				name: "",
			},
			readyIds: [],
			ignorePreventKeys: ["F11", "F12", "F5"],
			isPlay: true,
		};
	},
	mounted() {
		this.preloading = false;
		this.$refs.piano.$on("finished", () => {
			this.finished = true;
			this.progress = 100;
			this.socket.emit("GAME_OVER");
		});
		this.$refs.piano.$on("progress", (now) => {
			const last = this.midiNotes.slice(-1).pop();
			this.progress = last
				? ((now - this.startTime) /
						(this.blankTime + last.time * 1000)) *
				  100
				: 0;
		});
	},
	methods: {
		confirmInputName() {
			this.dialogVisible = false;
			const name = this.name.trim();
			if (name != "") {
				const { room, midi, velocity, auto, maxKeys } =
					this.$route.query;
				this.name = name;
				this.midiName = midi || this.midiName;
				this.vRatio = velocity || this.vRatio;
				this.allAuto = auto === "true" || this.allAuto;
				this.room = room || this.room;
				this.maxKeys =
					maxKeys > 0 && maxKeys <= this.keyboardList.length
						? maxKeys
						: this.maxKeys;
				return this.createSocket(name.trim());
			}
			this.exitOnError("无效输入.");
		},
		/* Socket 相关方法 */
		createSocket(name) {
			this.preloading = true;
			// 连接WebSocket服务器
			this.socket = io({
				reconnectionDelayMax: 10000,
				query: {
					name,
					mode: "solo",
					room: this.room,
					midiName: this.midiName,
					vRatio: this.vRatio,
					allAuto: this.allAuto,
					maxNotesMapNum: this.maxKeys,
				},
			});
			this.name = name;
			// 监听连接事件
			this.socket.on("connect", this.onConnect);
			this.socket.on("connect_error", this.onError);
			this.socket.on("error", this.onError);
			this.socket.on("disconnect", this.onDisConnect);
			this.socket.on("SERVER_TO_DISCONNECT", this.onServerToDisConnect);

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
			this.socket.on("READY_UPDATE", this.onReadyEvent);

			this.socket.on("GAME_START", this.onStartEvent);

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
		},
		onError(err) {
			console.error(err);
			alert(err);
			this.$router.replace("/home");
		},
		onDisConnect(reason) {
			console.error(reason);
			this.exitOnError(`连接已断开，断开原因: ${reason}`);
		},
		onServerToDisConnect(data) {
			this.exitOnError(data.errMsg);
		},
		onUpdatePlayers(data) {
			this.updatePlayersList(data.usersMap);
		},
		onResources(data) {
			// 返回房间配置参数 如{ notesResources, readyIds }
			if (!data || !data.notesResources || !data.readyIds) {
				this.exitOnError("服务端返回资源异常!");
			}
			this.loadedServerResources = true;
			const type = data.type ? data.type : "NEW";
			if (type === "NEW") {
				this.userId = data.userId;
			}
			this.notesResources = data.notesResources;
			this.readyIds = data.readyIds;
			this.roomCreator = data.creator;
			this.midiName = data.midiName;
			this.vRatio = data.vRatio;

			this.preloading = false;
		},
		onReadyEvent(data) {
			// data: 返回 {userId, readyIds, userNotesMap, allocEndPos}
			this.readyIds = data.readyIds;
			this.userNotesMap = data.userNotesMap;
			this.allocStartPos = data.allocStartPos;
			this.allocEndPos = data.allocEndPos;
			console.debug(data);

			// 创建键盘映射
			const notes = this.userNotesMap[this.userId] || [];
			const keyNotesMap = {};
			const noteKeysMap = {};
			notes.forEach((note, index) => {
				keyNotesMap[this.keyboardList[index]] = note;
				noteKeysMap[note] = this.keyboardList[index];
			});
			this.keyNotesMap = keyNotesMap;
			this.noteKeysMap = noteKeysMap;
		},
		onBroadcastNote(data) {
			// {
			//     note /* 音符 */,
			//     tickTime /* 音符在客户端的相对触发时间 */,
			//     time /* 音符的规定触发时间 */,
			//     duration /* 音符的规定持续时间 */,
			// }
			if (data.userId === this.userId) return;

			console.log(data);

			// 播放音符声音
			this.playSound(data.note);

			// 闪烁头像
			this.blinkAvatar(data.userId);

			this.$refs.piano.$emit("remotePressed", data.note);
		},
		onReleaseNote(data) {
			// {
			//     note /* 音符 */,
			//     releaseTime /* 音符在客户端的相对触发时间 */,
			//     time /* 音符的规定触发时间 */,
			//     duration /* 音符的规定持续时间 */,
			// }
			if (data.userId === this.userId) return;

			// 播放音符声音
			this.stopSound(data.note);

			// 闪烁头像
			this.blinkAvatar(data.userId);

			this.$refs.piano.$emit("remoteReleased", data.note);
		},
		onStartEvent(data) {
			this.preloading = false;
			this.started = true;
			const notes = this.midiNotes;
			const _toStartTime = this.toStartTime;
			this.startTime = +new Date();
			const countFun = () => {
				this.$message.success(`倒计时 ${this.toStartTime / 1000}`);
				this.toStartTime -= 1000;
				if (this.toStartTime > 0) {
					const timer = setTimeout(countFun, 1000);
				} else {
					this.toStartTime = _toStartTime;
					// 启动音乐雨
					this.$refs.piano.$emit(
						"startRain",
						notes,
						this.blankTime,
						this.notesResources,
						this.userNotesMap[this.userId],
						this.keyNotesMap,
						this.noteKeysMap,
						this.allocStartPos,
						this.allocEndPos
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
			if (this.started) return;
			if (!this.ready && !this.loadedServerResources) {
				this.$message.error("服务器资源未正确加载.");
				return;
			}
			this.ready = !this.ready;
			this.readyText = this.ready ? "取消准备" : "点我准备";
			if (this.ready) {
				// 显示加载动画
				this.preloading = true;
				// 加载播放环境
				if (!this.instrument) {
					this.loadInstrument("Salamander piano", () => {
						// 获取midi文件并解析为JSON
						this.getMidiJson(this.midiName).then((notes) => {
							notes.forEach((note) => {
								note.time /= this.vRatio;
								note.duration /= this.vRatio;
							});
							this.midiNotes = notes;

							// 发送准备事件给服务器
							this.socket.emit("CLI_READY", { name: this.name });
							// // 结束加载动画
							this.preloading = false;
						});
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
		/**
		 * 开始游戏
		 */
		toStart() {
			if (!this.ready) return;
			if (this.started) return;

			this.preloading = true;
			this.socket.emit("GAME_START", { tickTime: +new Date() });
		},
		// 监听键盘事件
		addKeyDownListener() {
			window.addEventListener("keydown", this.onKeyDown);
		},
		addKeyUpListener() {
			window.addEventListener("keyup", this.onKeyUp);
		},
		onKeyDown(e) {
			if (!this.ready || !this.instrument) return;
			// !this.ignorePreventKeys.includes(e.key) && e.preventDefault();
			if (e.key in this.keyNotesMap) {
				e.preventDefault();
			}

			if (e.key in this.keyNotesMap && !this.keyPressed.has(e.key)) {
				const note = this.keyNotesMap[e.key];
				this.$refs.piano.$emit("handleKeyDown", note);
				this.keyPressed.add(e.key);
				this.instrument.triggerAttack(note);

				this.socket.emit("CLI_BROADCAST_NOTE", {
					userId: this.userId,
					note,
					tickTime: +new Date() - this.startTime,
				});
				this.blinkAvatar(this.userId);
			}
		},
		onKeyUp(e) {
			e.preventDefault();

			if (!this.ready || !this.instrument) return;

			if (e.key in this.keyNotesMap && this.keyPressed.has(e.key)) {
				const note = this.keyNotesMap[e.key];
				this.$refs.piano.$emit("handleKeyUp", note);
				this.keyPressed.delete(e.key);
				this.instrument.triggerRelease(this.keyNotesMap[e.key]);

				this.socket.emit("CLI_RELEASE_NOTE", {
					userId: this.userId,
					note,
					releaseTime: +new Date() - this.startTime,
				});
			}
		},
		/* 音频处理 */
		// 创建音频元素
		// 播放音符的函数
		playSound(note) {
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
		cleanPlayer() {
			this.$refs.piano.$emit("stopRain");
			this.instrument && this.instrument.releaseAll();
			this.cleanPlayTimer();
		},
		handlePlay() {
			this.isPlay = !this.isPlay;
			if (!this.isPlay) {
				this.pausedIdx = this.releasedIdx;
				this.cleanPlayer();
			} else {
				this.$refs.piano.$emit("continueRain");
				// 播放notes
				this.playCurrentNotesTimer(
					this.midiNotes,
					this.blankTime,
					this.notesResources.slice(
						this.allocStartPos,
						this.allocEndPos > 0 ? this.allocEndPos + 1 : 0
					)
				);
			}
		},
		exitOnError(err) {
			this.$message.error(`${err} 【即将返回首页!】`);
			this.cleanPlayer();
			setTimeout(() => {
				this.$router.replace("/home");
			}, 1500);
		},
	},
	beforeDestroy() {
		this.cleanPlayer();
	},
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
@import "@/styles/solo.scss";

.logo-rain {
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	overflow: hidden;

	&-item {
		position: absolute;
		width: 460px;
		height: 400px;
		top: calc(50% - 300px);
		left: calc(50% - 225px);
		&:nth-child(1) {
			animation: logoAnimationLeft 3s 1;
			animation-fill-mode: forwards;
		}
		&:nth-child(2) {
			animation: logoAnimationRight 3s 1;
			animation-fill-mode: forwards;
		}
	}
}
@keyframes logoAnimationLeft {
	0% {
		transform: rotate(0deg) scale(1);
		top: 0;
		left: 0;
		opacity: 0;
	}
	100% {
		transform: rotate(720deg) scale(0.5);
		top: calc(50% - 300px);
		left: calc(50% - 225px);
		opacity: 1;
	}
}

@keyframes logoAnimationRight {
	0% {
		transform: rotate(0deg) scale(1);
		top: 0;
		left: 100%;
		opacity: 0;
	}
	100% {
		transform: rotate(720deg) scale(0.5);
		top: calc(50% - 300px);
		left: calc(50% - 225px);
		opacity: 1;
	}
}
</style>
