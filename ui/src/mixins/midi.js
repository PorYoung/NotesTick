import * as Tone from "tone";
import { Midi } from "@tonejs/midi";

let currentNoteIndex = 0;
let currentNote = null;
let playStartTime = null;
export default {
	data() {
		return {
			midiNotes: [],
			vRatio: 0.75,
		};
	},
	methods: {
		/*  */
		async getMidiJson(midiName = "我爱你中国") {
			const midiUrl = `/static/midi/${midiName}.mid`;
			const midi = await Midi.fromUrl(midiUrl);
			//the file name decoded from the first track
			const name = midi.name;

			// 获取所有音符信息
			const notes = midi.tracks.reduce(
				(allNotes, track) => allNotes.concat(track.notes),
				[]
			);
			this.midiNotes = notes;

			return notes;
		},
		playCurrentNotes(notes, blankTime = 1000, skipNotes = []) {
			const now = Tone.now() + 0.5;
			notes.forEach((note) => {
				if (note.name in skipNotes) return;

				console.debug(
					now,
					note.name,
					note.duration,
					note.time + now + blankTime / 1000,
					note.velocity
				);
				try {
					// 时间*vRatio 表示 1/vRatio倍速进行
					this.instrument.triggerAttackRelease(
						note.name,
						note.duration,
						note.time + now + blankTime / 1000,
						note.velocity
					);
				} catch (exp) {
					console.error(exp, note);
				}
			});
		},
		playCurrentNotesStep(notes, blankTime = 1000, skipNotes = []) {
			const now = Tone.now() + 0.5;
			notes.forEach((note) => {
				if (note.name in skipNotes) return;

				console.debug(
					now,
					note.name,
					note.duration,
					blankTime / 1000 + note.time + now,
					note.velocity
				);
				this.instrument.triggerAttack(
					note.name,
					blankTime / 1000 + note.time + now,
					note.velocity
				);
				this.instrument.triggerRelease(
					note.name,
					blankTime / 1000 + note.duration + note.time + now
				);
			});
		},
		playCurrentNotesTimer(notes, blankTime = 1000, skipNotes = []) {
			this.midiNotes.forEach((note) => {
				if (skipNotes.includes(note.name)) return;

				setTimeout(() => {
					this.instrument.triggerAttack(
						note.name,
						"+0",
						note.velocity
					);
				}, blankTime + note.time * 1000);
				setTimeout(() => {
					this.instrument.triggerRelease(
						note.name,
						blankTime + (note.duration + note.time) * 1000
					);
				});
			});
		},
		playCurrentNotesSingleTimer(notes, blankTime = 1000, skipNotes = []) {
			playStartTime = playStartTime ? playStartTime : +new Date();
			let now = +new Date();
			let progress = now - playStartTime;
			if (currentNoteIndex < notes.length) {
				currentNote = notes[currentNoteIndex];
				if (
					currentNote.time * 1000 <= progress &&
					!(currentNote.note in skipNotes)
				) {
					this.instrument.triggerAttackRelease(
						currentNote.name,
						currentNote.duration,
						"+0",
						currentNote.velocity
					);
					console.log(
						currentNote,
						playStartTime,
						now,
						progress,
						currentNote.time * 1000
					);
					currentNoteIndex++;
				}
				setTimeout(this.playCurrentNotesSingleTimer, 10);
			} else {
				// 音乐播放完毕
				console.log("音乐播放完毕");
			}
		},
	},
};
