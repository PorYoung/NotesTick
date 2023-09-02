import * as Tone from "tone";
import { Midi, Track } from "@tonejs/midi";
import { NoteJSON } from "@tonejs/midi/dist/Note";
import { ElMessage } from "element-plus";
import { CustomInstrument } from "./instruments";

export class MidiController {
  instrument: CustomInstrument;
  currentNoteIndex: number = 0; // 当前播放音符的索引
  currentNote: string = ""; // 当前播放音符的name
  playStartTime: number = 0; // 开始播放的时间
  notesPlayTimers: Set<number> = new Set(); // 音符播放列表的定时器
  midiNotes: NoteJSON[] = []; // 音符列表
  pausedIdx: number = -1; // 暂停时的音符索引
  releasedIdx: number = -1; // 恢复播放时的音符索引
  vRatio: number = 0.75; // 播放速率

  constructor(instrument: CustomInstrument) {
    this.instrument = instrument;
  }

  /* 请求Midi文件信息并获取音符列表 */
  async getMidiJson(midiName: string) {
    const midiUrl = `/static/midi/${midiName}`;
    const midi = await Midi.fromUrl(midiUrl);

    // 获取所有音符信息
    const notes = midi.tracks.reduce(
      (allNotes: NoteJSON[], track: Track) => allNotes.concat(track.notes),
      []
    );
    this.midiNotes = notes;

    return notes;
  }

  /* 自动播放当前全部音符 （可能存在兼容问题） */
  playCurrentNotes(notes: NoteJSON[], blankTime = 1000, skipNotes = []) {
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
        ElMessage.error("出错啦！");
      }
    });
  }

  /* 自动播放当前全部音符 （可能存在兼容问题） */
  playCurrentNotesStep(notes: NoteJSON[], blankTime = 1000, skipNotes = []) {
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
  }

  /* 使用定时器自动播放当前全部音符 （可能存在性能和准确性问题） */
  playCurrentNotesTimer(
    notes: NoteJSON[],
    blankTime = 1000,
    skipNotes: string[] = []
  ) {
    notes.forEach((note, index) => {
      if (skipNotes.includes(note.name)) return;
      if (index <= this.pausedIdx) return;
      if (this.pausedIdx >= 0) {
        const pausedNote = this.midiNotes[this.pausedIdx];
        blankTime -= (pausedNote.time + pausedNote.duration) * 1000;
      }

      const playTimer = setTimeout(() => {
        this.instrument.triggerAttack(note.name, "+0", note.velocity);
        this.notesPlayTimers.delete(playTimer);
      }, blankTime + note.time * 1000);
      const releaseTimer = setTimeout(() => {
        this.instrument.triggerRelease(
          note.name,
          blankTime + (note.duration + note.time) * 1000
        );
        this.notesPlayTimers.delete(releaseTimer);
        this.releasedIdx = index > this.releasedIdx ? index : this.releasedIdx;
      });
      this.notesPlayTimers.add(playTimer);
      this.notesPlayTimers.delete(releaseTimer);
    });
  }

  cleanPlayTimer() {
    for (const timer of this.notesPlayTimers) {
      clearTimeout(timer);
    }
    this.notesPlayTimers.clear();
    this.releasedIdx = -1;
  }

  testPlay(note: string, instrument: any) {
    instrument.triggerAttack(note);
  }

  test() {
    this.instrument.triggerAttack("C3");
  }
}

export function buildMidiController(instrument: CustomInstrument) {
  return new MidiController(instrument);
}
