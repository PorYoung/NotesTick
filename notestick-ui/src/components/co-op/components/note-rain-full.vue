<template>
  <div class="note-container" v-loading.fullscreen.lock="preloading">
    <canvas ref="canvas" class="canvas"></canvas>
    <div class="line">
      <div
        v-for="note in notesResources"
        :key="note"
        :style="{
          width: blockWidth + 'px',
          padding: `0 ${blockGap}px;`,
        }"
        class="key"
        :class="{
          active: activeNotes.includes(note),
          'bind-key': bindNotes.includes(note),
          'remote-pressed': remotePressedNotes.includes(note),
          hinted: hintedBlocks.some((item) => item.name === note),
        }"
      >
        {{
          bindNotes.includes(note)
            ? noteKeysMap[note].toLocaleUpperCase()
            : note
        }}
      </div>
    </div>
  </div>
</template>

<script>
import { $on, $off, $once, $emit } from "@/utils/gogocodeTransfer";
import * as Tone from "tone";
import MidiMixin from "@/mixins/midi";
import { v4 } from "uuid";
export default {
  name: "full-screen-piano",
  mixins: [MidiMixin],
  computed: {
    canvasWidth() {
      return this.$refs.canvas.parentNode.clientWidth * 0.98;
    },
    canvasHeight() {
      return this.$refs.canvas.parentNode.clientHeight * 0.98;
    },
    firstBindKeyOffset() {
      if (this.bindNotes.length <= 0) return 0;
      return (
        this.notesResources.indexOf(this.bindNotes[0]) -
        Math.floor(this.notesResources.length / 2)
      );
    },
  },
  data() {
    return {
      notesResources: ["C4"],
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
      midiName: "我爱你中国.mid",
      activeNotes: [], // 记录当前按下的音符,
      bindNotes: [],
      keyNotesMap: {},
      noteKeysMap: {},
      hintEarlyTime: 0,
      hintedBlocks: [],
      remotePressedNotes: [],
      updatedBlocks: [],
      isPlay: true,
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
      this.WIDTH = this.canvasWidth || 1200;
      this.HEIGHT = this.canvasHeight || 400;
      this.blockWidth = this.WIDTH / this.notesResources.length;
      this.firstNoteTime = this.notes[0].time * 1000;
      this.moveVelocity = this.HEIGHT / (this.blankTime + this.firstNoteTime);
      this.hintEarlyPx = this.moveVelocity * this.hintEarlyTime;
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
          -(note.time * 1000 - this.firstNoteTime) * this.moveVelocity - h;
        const noteBlock = {
          id: v4(),
          name: note.name,
          key: this.noteKeysMap[note.name],
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
        if (block.y >= this.HEIGHT + block.height) {
          // 在按键提示列表中移除当前音符
          this.hintedBlocks = this.hintedBlocks.filter(
            (item) => item.id !== block.id
          );
        }
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
        // 按键提示
        if (block.y + block.height + this.hintEarlyPx >= this.HEIGHT) {
          // @todo: 更换性能更优的方案
          const existed = this.hintedBlocks.some(
            (item) => item.id === block.id
          );
          !existed && this.hintedBlocks.push(block);
        }
      }

      this.animationId = requestAnimationFrame(() => {
        const { updatedBlocks, now } = this.updateNotesBlock(
          notesBlocks,
          lastTime
        );
        this.updatedBlocks = updatedBlocks;
        cancelAnimationFrame(this.animationId);
        if (updatedBlocks.length > 0 && this.isPlay) {
          $emit(this, "progress", +new Date());
          this.draw(this.updatedBlocks, now);
        } else if (updatedBlocks.length > 0 && !this.isPlay) {
          return;
        } else {
          $emit(this, "finished", true);
        }
      });
    },
    onRemotePressed(note) {
      this.remotePressedNotes.push(note);
      console.log(this.remotePressedNotes);
    },
    onRemoteReleased(note) {
      this.remotePressedNotes.splice(this.remotePressedNotes.indexOf(note), 1);
    },
  },
  mounted() {
    const canvas = this.$refs.canvas;
    this.ctx = canvas.getContext("2d");
    // 设置canvas的宽度和高度
    canvas.width = this.canvasWidth;
    canvas.height = this.canvasHeight;

    $on(
      this,
      "startRain",
      (
        notes,
        blankTime,
        notesResources,
        bindNotes,
        keyNotesMap,
        noteKeysMap,
        allocStartPos,
        allocEndPos
      ) => {
        this.notes = notes;
        this.blankTime = blankTime;
        this.notesResources = notesResources;
        this.bindNotes = bindNotes;
        this.keyNotesMap = keyNotesMap;
        this.noteKeysMap = noteKeysMap;
        this.allocStartPos = allocStartPos;
        this.allocEndPos = allocEndPos;
        this.createNote();
      }
    );
    $on(this, "continueRain", () => {
      this.isPlay = true;
      this.draw(this.updatedBlocks, +new Date());
    });
    $on(this, "stopRain", () => {
      this.isPlay = false;
      this.notes = [];
      Tone.Transport.stop();
    });
    //按下按钮触发事件
    $on(this, "handleKeyDown", (note) => {
      if (note && !this.activeNotes.includes(note)) {
        this.activeNotes.push(note);
      }
    });
    //松开按钮触发事件
    $on(this, "handleKeyUp", (note) => {
      if (note && this.activeNotes.includes(note)) {
        const index = this.activeNotes.indexOf(note);
        this.activeNotes.splice(index, 1);
      }
    });
    $on(this, "remotePressed", (note) => {
      this.onRemotePressed(note);
    });
    $on(this, "remoteReleased", (note) => {
      this.onRemoteReleased(note);
    });
  },
  emits: ["progress", "finished"],
};
</script>

<style lang="scss" scoped>
@import "@/styles/note-rain.scss";
.note-container {
  width: 98%;
  max-height: 100vh;
  .hinted {
    background-color: coral !important;
    box-shadow: 0 0 10px rgba(255, 0, 102, 0.8);
  }
}
</style>
