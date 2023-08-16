<template>
	<div class="note-container" v-loading.fullscreen.lock="preloading">
		<canvas ref="canvas" width="1200" height="400" class="canvas"></canvas>
		<div class="line">
			<div
				v-for="note in notesResources"
				:key="note"
				:style="{ width: blockWidth - blockGap + 'px' }"
				class="key"
				:class="{ active: activeNotes.includes(note) }"
			>
				{{ note }}
			</div>
		</div>
	</div>
</template>

<script>
import * as Tone from "tone";
import MidiMixin from "@/mixins/midi";
export default {
	mixins: [MidiMixin],
	data() {
		return {
			notesResources: [],
			ctx: null,
			animationId: null,
			WIDTH: 0,
			HEIGHT: 0,
			blockWidth: 0,
			blankTime: 1000,
			firstNoteTime: 0,
			moveVelocity: 0,
			blockGap: 2,
			animationId: null,
			preloading: false,
			notes: [],
			synth: new Tone.Synth().toDestination(),
			audioContextStarted: false,
			// midiNotes: null,
			midiName: "我爱你中国",
			activeNotes: [], // 记录当前按下的音符
		};
	},
	methods: {
		async loadMidiNotes() {
			this.preloading = true;
			const notes = await this.getMidiJson();
			this.preloading = false;

			return notes;
		},
		createNote() {
			this.WIDTH = this.ctx.width || 1200;
			this.HEIGHT = this.ctx.height || 400;
			this.blockWidth = this.WIDTH / this.notesResources.length;
			this.firstNoteTime = this.notes[0].time * 1000;
			this.moveVelocity =
				this.HEIGHT / (this.blankTime + this.firstNoteTime);
			this.animationId = requestAnimationFrame(() => {
				const notesBlocks = this.createNotesBlock(this.notes);
				this.draw(notesBlocks, +new Date());
			});
		},
		createNotesBlock(notes) {
			const notesBlocks = [];
			notes.forEach((note) => {
				const x =
					this.notesResources.indexOf(note.name) * this.blockWidth +
					this.blockGap;
				const h = note.duration * 1000 * this.moveVelocity;
				const w = this.blockWidth - this.blockGap * 2;
				const y =
					-(note.time * 1000 - this.firstNoteTime) *
						this.moveVelocity -
					h;
				const noteBlock = {
					name: note.name,
					x: x,
					y: y,
					height: h,
					width: w,
				};
				notesBlocks.push(noteBlock);
			});
			return notesBlocks;
		},
		updateNotesBlock(notesBlocks, lastTime) {
			const now = +new Date();
			const passed = now - lastTime;
			notesBlocks.forEach((block) => {
				block.y += passed * this.moveVelocity;
			});
			const updatedBlocks = notesBlocks.filter((block) => {
				return block.y <= this.HEIGHT + block.height;
			});

			return { updatedBlocks, now };
		},
		draw(notesBlocks, lastTime) {
			// 清空画布
			this.ctx.clearRect(0, 0, this.WIDTH, this.HEIGHT);
			// 绘制音符块
			for (let i = 0; i < notesBlocks.length; i++) {
				const block = notesBlocks[i];

				// 绘制音符块
				let gradient = this.ctx.createLinearGradient(
					block.x,
					block.y,
					block.width,
					block.height
				);
				gradient.addColorStop(0, "rgb(198, 255, 221)");
				gradient.addColorStop(0.5, "rgb(251, 215, 134)");
				gradient.addColorStop(1, "rgb(247, 121, 125)");
				let gradient2 = this.ctx.createLinearGradient(
					block.x,
					block.y,
					block.width,
					block.height
				);
				gradient2.addColorStop(0, "rgb(211, 204, 227)");
				gradient2.addColorStop(1, "rgb(233, 228, 240)");
				this.ctx.fillStyle = block.highlighted ? gradient2 : gradient;

				// 绘制圆角矩形
				const cornerRadius = 3; // 圆角半径
				this.ctx.beginPath();
				this.ctx.moveTo(block.x + cornerRadius, block.y);
				this.ctx.lineTo(block.x + block.width - cornerRadius, block.y);
				this.ctx.arc(
					block.x + block.width - cornerRadius,
					block.y + cornerRadius,
					cornerRadius,
					-Math.PI / 2,
					0
				);
				this.ctx.lineTo(
					block.x + block.width,
					block.y + block.height - cornerRadius
				);
				this.ctx.arc(
					block.x + block.width - cornerRadius,
					block.y + block.height - cornerRadius,
					cornerRadius,
					0,
					Math.PI / 2
				);
				this.ctx.lineTo(block.x + cornerRadius, block.y + block.height);
				this.ctx.arc(
					block.x + cornerRadius,
					block.y + block.height - cornerRadius,
					cornerRadius,
					Math.PI / 2,
					Math.PI
				);
				this.ctx.lineTo(block.x, block.y + cornerRadius);
				this.ctx.arc(
					block.x + cornerRadius,
					block.y + cornerRadius,
					cornerRadius,
					Math.PI,
					-Math.PI / 2
				);
				this.ctx.closePath();

				this.ctx.fill();

				// 判断音符块是否触及底部白线
				if (block.y + block.height >= this.HEIGHT) {
					// 判断是否需要触发音符块的发亮效果
					block.highlighted = true;
				}
			}

			this.animationId = requestAnimationFrame(() => {
				const { updatedBlocks, now } = this.updateNotesBlock(
					notesBlocks,
					lastTime
				);
				updatedBlocks.length > 0
					? this.draw(updatedBlocks, now)
					: cancelAnimationFrame(animationId);
			});
		},
	},
	mounted() {
		this.ctx = this.$refs.canvas.getContext("2d");
		this.$on("startRain", (notes, blankTime, notesResources) => {
			this.notes = notes;
			this.blankTime = blankTime;
			this.notesResources = notesResources;
			// this.loadMidiNotes();
			this.createNote();
		});
		this.$on("stopRain", () => {
			this.notes = [];
			Tone.Transport.stop();
		});
		//按下按钮触发事件
		this.$on("handleKeyDown", (note) => {
			if (note && !this.activeNotes.includes(note)) {
				this.activeNotes.push(note);
			}
		});
		//松开按钮触发事件
		this.$on("handleKeyUp", (note) => {
			if (note && this.activeNotes.includes(note)) {
				const index = this.activeNotes.indexOf(note);
				this.activeNotes.splice(index, 1);
			}
		});
	},
};
</script>

<style lang="scss" scoped>
.note-container {
	position: relative;
	width: 88%;
	height: 100%;
	margin-left: 6%;
	overflow: hidden;

	.canvas {
		position: absolute;
		left: 0%;
	}
	.line {
		position: absolute;
		left: 0;
		bottom: 0;
		width: 1200px;
		height: 16px;
		.key {
			display: inline-block;
			height: 16px;
			font-size: 6px;
			color: #000;
			border: 1px solid #000;
			background-color: #fff;
			text-align: center;
		}

		.active {
			background-color: #bf15ee;
			box-shadow: 0 0 10px rgba(255, 0, 102, 0.8);
		}
	}
}
</style>
