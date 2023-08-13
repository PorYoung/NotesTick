<!--
  @name: solo.vue
  @date: 2023-08-12
  @version：0.0.1
  @describe: 合奏模式页面
-->

<template>
	<div>
		<!-- 请求乐谱和加载Tone资源时，页面进入加载状态 -->
		<el-row v-loading.fullscreen.lock="preloading"></el-row>
		<!-- 音符雨 -->
		<el-row class="notes-rain"></el-row>
		<!-- 玩家信息盒子 -->
		<div>
			<!-- 状态栏 -->
			<div>
				<button id="start" @click="joinGame">
					{{ readyText }} {{ _len(readyPlayers) }} /
					{{ _len(players) }} 玩家已准备
				</button>
			</div>
			<!-- 玩家列表 -->
			<div
				id="players"
				ref="players"
				v-for="item in players"
				:key="item.name"
			>
				<div class="player">
					<img src="@static/images/avatar.jpg" />
					<span>{{ item.name }}</span>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import io from "socket.io-client";
import CommonMixin from "@/mixins/common";
import InstrumentsMixin from "@/mixins/instruments";
import MidiMixin from "@/mixins/midi";
export default {
	name: "Solo",
	mixins: [CommonMixin, InstrumentsMixin, MidiMixin],
	data() {
		return {
			/* 页面参数 */
			preloading: true,
			/* 加载 MIDI 文件 */
			midiUrl: "",
			/* Socket 相关变量 */
			socket: null,
			/* 音符控制相关变量 */
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
				if (data.id === this.socket.id) return;

				// 播放音符声音
				this.playSound(data.note);

				// 闪烁头像
				this.blinkAvatar(data.id);
			});

			// 监听播放音符事件
			this.socket.on("stopNote", (data) => {
				if (data.id === this.socket.id) return;

				// 播放音符声音
				this.stopSound(data.note);

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
			this.$router.replace("/home");
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
			if (this.ready && !this.instrument) {
				this.preloading = true;
				this.loadInstrument("Salamander piano", () => {
					this.preloading = false;
				});
			}
			this.getMidiJson().then(() => [this.playCurrentNote()]);
			return;
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
			if (!this.ready || !this.instrument) return;

			if (!this.keyLock && e.key == " ") {
				this.instrument.triggerAttack(this.myNote);
				this.keyLock = true;
				this.socket.emit("keydown", { note: this.myNote });
				this.blinkAvatar();
			}
		},
		onKeyUp(e) {
			if (!this.ready || !this.instrument) return;

			if (this.keyLock && e.key == " ") {
				this.instrument.triggerRelease(this.myNote);
				this.keyLock = false;
				this.socket.emit("keyup", { note: this.myNote });
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
			this.players = data;
		},
	},
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss"></style>
