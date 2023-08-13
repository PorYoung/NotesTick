import * as Tone from "tone";
import { Midi } from "@tonejs/midi";

let currentNoteIndex = 0;
let currentNote = null;
let playStartTime = null;
export default {
	data() {
		return {
			midiNotes: [],
		};
	},
	methods: {
		/*  */
		async getMidiJson() {
			// const midi = await Midi.fromUrl("/static/midi/qingtian.mid");
			const midi = await Midi.fromUrl("/static/midi/我爱你中国.mid");
			//the file name decoded from the first track
			const name = midi.name;

			// 获取所有音符信息
			const notes = midi.tracks.reduce(
				(allNotes, track) => allNotes.concat(track.notes),
				[]
			);
			this.midiNotes = notes;

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
		playCurrentNote() {
			const now = Tone.now() + 0.5;
			this.midiNotes.forEach((note) => {
				console.log(
					now,
					note.name,
					note.duration,
					note.time + now,
					note.velocity
				);
				try {
					this.instrument.triggerAttackRelease(
						note.name,
						note.duration,
						note.time + now,
						note.velocity
					);
				} catch (exp) {
					console.error(exp, note);
				}
			});
		},
		playCurrentNoteV1() {
			playStartTime = playStartTime ? playStartTime : +new Date();
			let now = +new Date();
			let progress = now - playStartTime;
			let notes = this.midiNotes;
			if (currentNoteIndex < notes.length) {
				currentNote = notes[currentNoteIndex];
				if (currentNote.time * 1000 < progress) {
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