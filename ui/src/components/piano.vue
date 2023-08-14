<template>
	<div class="note-container" v-loading.fullscreen.lock="preloading">
		<div
			v-for="note in notes"
			:key="note.id"
			class="note"
			:style="note.style"
			@animationstart="showNote(note.id)"
			@animationend="removeNote(note.id)"
		></div>
	</div>
</template>

<script>
import * as Tone from "tone";
import noteMapping from "@static/js/noteMapping";
import MidiMixin from "@/mixins/midi";
export default {
	props: {
		midiJson: null,
	},
	mixins: [MidiMixin],
	data() {
		return {
			preloading: false,
			notes: [],
			synth: new Tone.Synth().toDestination(),
			audioContextStarted: false,
			midiName: "我爱你中国",
		};
	},
	methods: {
		async loadMidiJson() {
			this.preloading = true;
			const midiJson = await this.getMidiJson();
			this.preloading = false;

			return midiJson;
		},
		async createNote() {
			this.midiJson.forEach((item, index) => {
				let duration = item.duration;
				const note = {
					id: index,
					style: {
						height: `${duration * 100}px`,
						left: `${6 + noteMapping[item.name]}%`,
						animationDuration: `${item.velocity * 3}s`,
						animationDelay: `${item.time}s`,
						background:
							"linear-gradient(to right, rgb(198, 255, 221), rgb(251, 215, 134), rgb(247, 121, 125))",
					},
				};
				this.notes.push(note);
			});
		},
		async startAudio() {
			const midiJson = this.midiJson
				? this.midiJson
				: await loadMidiJson();

			if (!this.audioContextStarted) {
				Tone.start();
				this.audioContextStarted = true;
			}

			// 开始创建音符
			const bpm = 120;
			const interval = 60000 / bpm;

			Tone.Transport.scheduleRepeat(() => {
				this.createNote();
			}, interval);

			Tone.Transport.start();
		},
		showNote(id) {
			const index = this.notes.findIndex((note) => note.id === id);
			this.notes[index].style.opacity = 1;
		},
		removeNote(id) {
			const index = this.notes.findIndex((note) => note.id === id);
			if (index !== -1) {
				this.notes.splice(index, 1);
			}
		},
	},
	mounted() {
		this.$on("startRain", () => {
			this.startAudio();
		});
		this.$on("stopRain", () => {
			this.notes = [];
			Tone.Transport.stop();
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

	&::after {
		content: " ";
		position: absolute;
		left: 0;
		bottom: 0;
		height: 16px;
		width: 100%;
		background-color: white;
	}
}

.note {
	position: absolute;
	width: 1%;
	opacity: 0; /* 初始时设置音符不可见 */
	animation: fallAnimation linear;
}

@keyframes fallAnimation {
	0% {
		transform: translateY(-100%);
		opacity: 1;
	}
	100% {
		transform: translateY(100vh);
		opacity: 1;
	}
}
</style>
