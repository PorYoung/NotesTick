import * as Tone from "tone";
import { Midi } from "@tonejs/midi";

let currentNoteIndex = 0;
let currentNote = null;
let playStartTime = null;
export default {
	data() {
		return {
			midiNotes: [],
			vRatio: 1,
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
			//get the tracks
			// midi.tracks.forEach((track) => {
			// 	//tracks have notes and controlChanges

			// 	//notes are an array
			// 	const notes = track.notes;
			// 	notes.forEach((note) => {
			// 		//note.midi, note.time, note.duration, note.name
			// 	});

			// 	//the control changes are an object
			// 	//the keys are the CC number
			// 	track.controlChanges[64];
			// 	//they are also aliased to the CC number's common name (if it has one)
			// 	track.controlChanges.sustain.forEach((cc) => {
			// 		// cc.ticks, cc.value, cc.time
			// 	});

			// 	//the track also has a channel and instrument
			// 	//track.instrument.name
			// });
		},
		playCurrentNotes() {
			const now = Tone.now() + 0.5;
			this.midiNotes.forEach((note) => {
				console.debug(
					now,
					note.name,
					note.duration,
					note.time + now,
					note.velocity
				);
				try {
					// 时间*vRatio 表示 1/vRatio倍速进行
					this.instrument.triggerAttackRelease(
						note.name,
						note.duration * this.vRatio,
						note.time * this.vRatio + now,
						note.velocity
					);
				} catch (exp) {
					console.error(exp, note);
				}
			});
		},
		playCurrentNotesStep() {
			const now = Tone.now() + 0.5;
			this.midiNotes.forEach((note) => {
				console.debug(
					now,
					note.name,
					note.duration,
					note.time + now,
					note.velocity
				);
				this.instrument.triggerAttack(
					note.name,
					note.time * this.vRatio + now,
					note.velocity
				);
				this.instrument.triggerRelease(
					note.name,
					(note.duration + note.time) * this.vRatio + now
				);
			});
		},
		playCurrentNotesSingleTimer() {
			playStartTime = playStartTime ? playStartTime : +new Date();
			let now = +new Date();
			let progress = now - playStartTime;
			let notes = this.midiNotes;
			if (currentNoteIndex < notes.length) {
				currentNote = notes[currentNoteIndex];
				if (currentNote.time * 1000 <= progress) {
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
				setTimeout(this.playCurrentNote, 10);
			} else {
				// 音乐播放完毕
				console.log("音乐播放完毕");
			}
		},
	},
};
