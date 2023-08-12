<template>
  <div>
    <div id="players" ref="players" v-for="item in players">
      <div class="player">
        <img src="../../public/images/avatar.jpg">
        <span>{{item.name}}</span>
      </div>
    </div>
    <button id="start" ref="start">Start</button>
    <audio id="noteAudio" ref="noteAudio"></audio>
  </div>
</template>

<script>
import io from "socket.io-client"
export default {
  name: 'game',
  data() {
    return {
      socket: null,
      keyLock: false,
      started: false,
      players: [],
      myNote: null
    }
  },
  mounted() {
    const name = prompt("请输入您的名字");
    if (name) {
      this.createSocket(name);
    }
  },
  methods: {
    createSocket(name) {
      // 连接WebSocket服务器
      this.socket = io('http://localhost:3000');
      // 监听连接事件
      this.socket.on("connect", () => {
        console.log("Connected to server");

        // 发送连接事件给服务器
        this.socket.emit("joinGame", { name });
      });
      let that = this
      // 监听键盘事件
      window.document.body.onkeypress = function(e){
        if (!this.keyLock && e.key == " ") {
          that.keyLock = true;
          that.socket.emit("keypress", { note: that.myNote });
          that.blinkAvatar();
          setTimeout(() => {
            that.keyLock = false;
          }, 100);
        }
      };

      // 监听播放音符事件
      this.socket.on("genNote", (data) => {
        this.myNote = data.note;
      });

      // 监听播放音符事件
      this.socket.on("playNote", (data) => {
        // 播放音符声音
        this.playSound(data.note);

        // 闪烁头像
        this.blinkAvatar(data.id);
      });

      // 监听开始按钮点击事件
      this.$refs.start.onClick = () => {
        if (this.started) {
          return;
        }
        this.started = true;
        // 发送开始事件给服务器
        this.socket.emit("startGame", { name });
      };

      // 监听用户列表更新事件
      this.socket.on("updatePlayers", (players) => {
        this.updatePlayersList(players);
      });

      // 监听准备用户列表更新事件
      this.socket.on("updateReadyPlayers", (incoming) => {
        console.log(`${incoming.length}/${players.length} 用户已准备`);
      });
    },
    /* 音频处理 */
    // 创建音频元素
    // 播放音符的函数
    playSound(note) {
      console.log("播放音符声音", note);
      const noteAudio = this.$refs.noteAudio;

      // 设置音频源
      noteAudio.src = `../../public/sound/${note}.mp3`;
      console.log(noteAudio.play)
      // 播放音频
      noteAudio.play();
    },
    // 闪烁头像的函数
    blinkAvatar(id) {
      // 添加你的头像闪烁的逻辑
      console.log("头像闪烁", id);
    },
    // 更新用户列表的函数
    updatePlayersList(incoming) {
      this.players = incoming;
    }
  },
}
</script>
	

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
