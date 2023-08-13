<template>
  <div class="note-container" @click="startAudio">
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
import musicJson from '../../static/js/jsons'
import noteMapping from "../../static/js/noteMapping";
export default {
  data() {
    return {
      musicJson: musicJson,
      notes: [],
      synth: new Tone.Synth().toDestination(),
      audioContextStarted: false,
    };
  },
  methods: {
    createNote() {
      this.musicJson.forEach((item, index) => {
        let duration = item.duration;
        const note = {
          id: index,
          style: {
            height: `${duration * 100}px`,
            left: `${noteMapping[item.name]}%`,
            animationDuration: `${item.velocity * 3}s`,
            animationDelay: `${item.time}s`,
            background: `linear-gradient(45deg, rgba(255, 0, 0, 0.8), rgba(0, 0, 255, 0.8))`,
          },
        };
        this.notes.push(note);
      });
      // 播放音符
      this.synth.triggerAttackRelease("C4", "8n"); // C4 音高，8n 持续时间
    },
    startAudio() {
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
      // console.log(this.notes)
      const index = this.notes.findIndex((note) => note.id === id);
      if (index !== -1) {
        this.notes.splice(index, 1);
      }
    },
  },
};
</script>

<style scoped>
.note-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.note {
  position: absolute;
  width: 30px;
  opacity: 0; /* 初始时设置音符不可见 */
  animation: fallAnimation linear;
}

@keyframes fallAnimation {
  0% {
    transform: translateY(-20px);
    opacity: 0;
  }
  100% {
    transform: translateY(100vh);
    opacity: 1;
  }
}
</style>
