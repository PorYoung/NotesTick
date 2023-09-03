<template>
  <el-container
    v-loading.fullscreen.lock="preloading"
    :class="{ 'main-wrapper': true, fullscreen: isFullScreen }"
  >
    <el-header>
      <el-progress :percentage="progress" status="exception"></el-progress>
    </el-header>
    <el-main>
      <note-rain
        ref="noteRain"
        @onFinished="onFinished"
        @onProgress="onProgress"
      />
    </el-main>
    <el-footer>
      <el-row :gutter="2">
        <el-col :span="6">
          <button class="btn" :disabled="started" @click="toReady">
            {{ started ? "游戏已开始" : readyText }}
          </button>
        </el-col>
        <el-col :span="6">
          <button
            class="btn"
            :disabled="started || !ready || userId !== roomCreator"
            @click="toStart"
          >
            {{
              userId === roomCreator
                ? `开始游戏 (${_len(readyIds)}
                            / ${_len(usersMap)} 玩家已准备)`
                : "等待游戏开始"
            }}
          </button>
        </el-col>
        <el-col :span="6"> 网络延迟:{{ latency }} ms </el-col>
        <el-col :span="6">
          <button
            class="btn"
            @click="handlePlay"
            :disabled="userId !== roomCreator"
          >
            {{ isPlay ? "暂停" : "播放" }}
          </button>
        </el-col>
      </el-row>

      <el-row :gutter="20" v-if="!isFullScreen">
        <el-col
          :span="3"
          v-for="item in usersMap"
          class="player"
          :key="item.id"
        >
          <el-row justify="center">
            <img src="@/assets/images/avatar.jpg" />
          </el-row>
          <el-row justify="center">
            <span>{{ item.name }}</span>
          </el-row>
        </el-col>
      </el-row>
    </el-footer>
    <el-dialog
      title="提示"
      v-model="dialogVisible"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      :center="true"
      :before-close="() => {}"
      width="30%"
    >
      <div slot="footer" class="dialog-footer">
        <el-button @click="backToHome">返回</el-button>
        <el-button type="primary" @click="firstConfirm">进入游戏</el-button>
      </div>
    </el-dialog>
    <div class="logo-rain" v-if="finished">
      <img src="@/assets/images/cgb.png" class="logo-rain-item" />
      <img src="@/assets/images/cgb.png" class="logo-rain-item" />
      <h2 class="animate__animated animate__zoomIn">✨🎉音乐完成✨🎉</h2>
    </div>
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage, ElDialog } from "element-plus";
import io from "socket.io-client";
import * as tools from "@/utils/tools";
import { buildMidiController, MidiController } from "@/utils/midi";
import { buildInstrumentAsync, CustomInstrument } from "@/utils/instruments";
import NoteRain from "./components/note-rain.vue";
import { NoteJSON, Note } from "@tonejs/midi/dist/Note";

const { _len } = { ...tools }; //工具函数

const router = useRouter(); // 路由
const route = useRoute();

/* 页面参数 */
const preloading = ref(true);
const dialogVisible = ref(true);
const isFullScreen = computed(() => {
  return route.query.fullScreen === "true";
});
// 用户名
const name = computed(() => {
  return (route.query.name as string).trim();
});
// 房间名称
const room = computed(() => {
  return route.query.room as string;
});
// midi 文件名
const midiName = computed(() => {
  return route.query.midi as string;
});
// 播放速度
const velocity = computed(() => {
  const _v = Number.parseFloat(route.query.velocity as string);
  return Number.isNaN(_v) && _v > 0 ? 1 : _v;
});
// 是否自动播放
const allAuto = computed(() => {
  return route.query.auto === "true";
});
const maxKeys = computed(() => {
  const _mk = Number.parseInt(route.query.maxKeys as string);
  return Number.isInteger(_mk) && _mk > 0 && _mk <= keyboardList.value.length
    ? _mk
    : 6;
});

/* 音符资源 */
const midiNotes = ref<NoteJSON[]>([]);
const notesResources = ref([]); // 乐曲涉及的全部音符
const allocStartPos = ref(0); // 音符资源中起始被分配的音符的位;
const allocEndPos = ref(0); // 音符资源中最后被分配的音符的位;
const userNotesMap = ref<{ [key: string]: any }>({}); // 用户与分配的音符映;

/* 音符控制相关变量 */
const loadedServerResources = ref(false);
const started = ref(false);
const finished = ref(false);
const toStartTime = ref(3000); // 正式启动倒计时m;
const blankTime = ref(1000);
const keyboardList = ref(["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]);
const keyNotesMap = ref<{ [key: string]: any }>({});
const noteKeysMap = ref({});
const keyPressed = ref<Set<string>>(new Set());
// const keyLock = ref(false);
const ready = ref(false);
const readyText = ref("点我准备 ");
const startTime = ref(0);
const progress = ref(0);
const releasedIdx = ref(-1); // midi notes中已经播放完成的音符索;
const isPlay = ref(true);
// const ignorePreventKeys = ref(["F11", "F12", "F5"]);

/* 用户相关变量 */
const userId = ref("");
const usersMap = ref<
  {
    id: string;
    name: string;
  }[]
>([]);
const readyIds = ref([]);

/* Instrument 部分 */
// @bug: 使用ref会导致DOM错误
let instrument: CustomInstrument; // 播放环境

/* Midi 部分 */
// @bug: 使用ref会导致DOM错误
let midiCtx: MidiController; // midi 控制器

/* 增加初次交互以初始化音频环境 */
const firstConfirm = () => {
  dialogVisible.value = false;
  preloading.value = true;
  // 加载播放环境
  buildInstrumentAsync("Salamander piano", (instance: CustomInstrument) => {
    instrument = instance;
    midiCtx = buildMidiController(instrument);
    checkQueryParams(() => {
      midiCtx.vRatio = velocity.value;
    });
    createSocket(name.value);
  });
  preloading.value = false;
};

const backToHome = () => {
  router.replace("/home");
};

/* 子组件DOM元素 */
const noteRain = ref();
/* 处理子组件事件 */
const onFinished = () => {
  finished.value = true;
  progress.value = 100;
  socket.value.emit("GAME_OVER");
};
const onProgress = (now: number) => {
  const last: NoteJSON | undefined = midiNotes.value.slice(-1).pop();
  progress.value = last
    ? ((now - startTime.value) / (blankTime.value + last.time * 1000)) * 100
    : 0;
};

/* 页面加载完成时处理方法 */
const checkQueryParams = (action: Function) => {
  if (name.value === "" || name.value === undefined) {
    return exitOnError("无效输入.");
  }
  action();
};
onMounted(() => {
  checkQueryParams(() => {});
  preloading.value = false;
});

/* Socket 部分 */
const socket = ref<any>();
const latency = ref(0);
const roomCreator = ref("");

const createSocket = (name: string) => {
  // 连接WebSocket服务器
  socket.value = io({
    reconnectionDelayMax: 10000,
    query: {
      name,
      mode: "co-op",
      room: room.value,
      midiName: midiName.value,
      vRatio: midiCtx?.vRatio,
      allAuto: allAuto.value,
      maxNotesMapNum: maxKeys.value,
    },
  });
  const st = socket.value;
  // 监听连接事件
  st.on("connect", onConnect);
  st.on("connect_error", onError);
  st.on("error", onError);
  st.on("disconnect", onDisConnect);
  st.on("SERVER_TO_DISCONNECT", onServerToDisConnect);

  // 监听键盘事件
  addKeyDownListener();
  addKeyUpListener();

  // 监听服务资源返回事件
  st.on("SERVER_RESOURCE", onResources);

  // 监听播放音符事件
  st.on("SERVER_BROADCAST_NOTE", onBroadcastNote);

  // 监听音符释放事件
  st.on("SERVER_RELEASE_NOTE", onReleaseNote);

  // 监听用户列表更新事件
  st.on("USERS_UPDATE", onUpdatePlayers);

  // 监听用户准备列表更新事件
  st.on("READY_UPDATE", onReadyEvent);

  st.on("GAME_START", onStartEvent);

  // 网络延迟检测
  const pingTimer = () => {
    st.emit("PING", { ping: +new Date() });
    setTimeout(pingTimer, 1000);
  };
  pingTimer();
  st.on("PONG", ({ ping = 0, pong = -1 }) => {
    latency.value = pong - ping;
  });
};

const onConnect = () => {
  ElMessage.success("连接服务器成功!");
  preloading.value = false;
};

const onError = (err: any) => {
  alert(err);
  router.replace("/home");
};

const onDisConnect = (reason: string) => {
  exitOnError(`连接已断开，断开原因: ${reason}`);
};

const onServerToDisConnect = (data: any) => {
  exitOnError(data.errMsg);
};

const onUpdatePlayers = (data: any) => {
  updatePlayersList(data.usersMap);
};

// 更新用户列表的函数
const updatePlayersList = (data: any) => {
  usersMap.value = data;
};

const onResources = (data: any) => {
  // 返回房间配置参数 如{ notesResources, readyIds }
  if (!data || !data.notesResources || !data.readyIds) {
    exitOnError("服务端返回资源异常!");
  }
  loadedServerResources.value = true;
  const type = data.type ? data.type : "NEW";
  if (type === "NEW") {
    userId.value = data.userId;
  }
  notesResources.value = data.notesResources;
  readyIds.value = data.readyIds;
  roomCreator.value = data.creator;
  !!midiCtx && (midiCtx.midiName = data.midiName);
  !!midiCtx && (midiCtx.vRatio = data.vRatio);

  // 请求midi数据
  midiCtx?.getMidiJson().then((notes: Note[]) => {
    const vRatio = midiCtx?.vRatio || 1;
    midiNotes.value = notes.map((note) => {
      note.time /= vRatio;
      note.duration /= vRatio;
      return note.toJSON();
    });

    // 结束加载动画
    preloading.value = false;
  });
};

const onReadyEvent = (data: any) => {
  // data: 返回 {userId, readyIds, userNotesMap, allocEndPos}
  readyIds.value = data.readyIds;
  userNotesMap.value = data.userNotesMap;
  allocStartPos.value = data.allocStartPos;
  allocEndPos.value = data.allocEndPos;
  console.debug(data);

  // 创建键盘映射
  const notes = data.userNotesMap[userId.value] || [];
  const _keyNotesMap: { [key: string]: any } = {};
  const _noteKeysMap: { [key: string]: any } = {};
  notes.forEach((note: string, index: number) => {
    _keyNotesMap[keyboardList.value[index]] = note;
    _noteKeysMap[note] = keyboardList.value[index];
  });
  keyNotesMap.value = _keyNotesMap;
  noteKeysMap.value = _noteKeysMap;
};

const onBroadcastNote = (data: any) => {
  if (data.userId === userId) return;

  console.log(data);

  // 播放音符声音
  playSound(data.note);

  // 闪烁头像
  blinkAvatar(data.userId);

  noteRain.value.onRemotePressed(data.note);
};

const onReleaseNote = (data: any) => {
  if (data.userId === userId.value) return;

  // 播放音符声音
  stopSound(data.note);

  // 闪烁头像
  blinkAvatar(data.userId);

  noteRain.value.onRemoteReleased(data.note);
};

// 用户准备处理方法
const toReady = () => {
  if (started.value) return;
  if (!ready.value && !loadedServerResources.value) {
    ElMessage.error("服务器资源未正确加载.");
    return;
  }
  ready.value = !ready.value;
  readyText.value = ready.value ? "取消准备" : "点我准备";
  if (ready.value) {
    // 发送准备事件给服务器
    socket.value.emit("CLI_READY", { name: name.value });
  } else {
    socket.value.emit("CLI_CANCEL_READY", { name: name.value });
  }
};

/**
 * 发起开始游戏请求
 */
const toStart = () => {
  if (!ready.value) return;
  if (started.value) return;

  preloading.value = true;
  socket.value.emit("GAME_START", { tickTime: +new Date() });
};

const onStartEvent = () => {
  preloading.value = false;
  started.value = true;
  const notes = midiNotes.value;
  const _toStartTime = toStartTime.value;
  startTime.value = +new Date();
  const countFun = () => {
    ElMessage.success(`倒计时 ${toStartTime.value / 1000}`);
    toStartTime.value -= 1000;
    if (toStartTime.value > 0) {
      setTimeout(countFun, 1000);
    } else {
      toStartTime.value = _toStartTime;
      // 启动音乐雨
      notes.forEach((note) => {
        note;
      });
      noteRain.value.onStartRain(
        notes,
        blankTime.value,
        notesResources.value,
        userNotesMap.value[userId.value],
        keyNotesMap.value,
        noteKeysMap.value,
        allocStartPos.value,
        allocEndPos.value
      );

      // 播放notes
      midiCtx?.playCurrentNotesTimer(
        notes,
        blankTime.value,
        notesResources.value.slice(
          allocStartPos.value,
          allocEndPos.value > 0 ? allocEndPos.value + 1 : 0
        )
      );
    }
  };
  countFun();
};

// 监听键盘事件
// 监听键盘事件
const addKeyDownListener = () => {
  window.addEventListener("keydown", onKeyDown);
};
const addKeyUpListener = () => {
  window.addEventListener("keyup", onKeyUp);
};
const onKeyDown = (e: KeyboardEvent) => {
  if (!ready || !instrument) return;
  if (e.key in keyNotesMap) {
    e.preventDefault();
  }

  if (e.key in keyNotesMap.value && !keyPressed.value.has(e.key)) {
    const note = keyNotesMap.value[e.key];
    noteRain.value.onHandleKeyDown(note);
    keyPressed.value.add(e.key);
    instrument?.triggerAttack(note);

    socket.value.emit("CLI_BROADCAST_NOTE", {
      userId: userId.value,
      note,
      tickTime: +new Date() - startTime.value,
    });
    blinkAvatar(userId.value);
  }
};
const onKeyUp = (e: KeyboardEvent) => {
  if (e.key in keyNotesMap) {
    e.preventDefault();
  }

  if (!ready.value || !instrument) return;

  if (e.key in keyNotesMap.value && keyPressed.value.has(e.key)) {
    const note = keyNotesMap.value[e.key];
    noteRain.value.onHandleKeyUp(note);
    keyPressed.value.delete(e.key);
    instrument.triggerRelease(keyNotesMap.value[e.key]);

    socket.value.emit("CLI_RELEASE_NOTE", {
      userId: userId.value,
      note,
      releaseTime: +new Date() - startTime.value,
    });
  }
};

/* 音频处理 */
// 播放音符的函数
const playSound = (note: string) => {
  instrument?.triggerAttack(note);
};
const stopSound = (note: string) => {
  instrument?.triggerRelease(note);
};

const handlePlay = () => {
  isPlay.value = !isPlay;
  if (!isPlay.value) {
    !!midiCtx && (midiCtx.pausedIdx = releasedIdx.value);
    cleanPlayer();
  } else {
    noteRain.value.onContinueRain();
    // 播放notes
    midiCtx?.playCurrentNotesTimer(
      midiNotes.value,
      blankTime.value,
      notesResources.value.slice(
        allocStartPos.value,
        allocEndPos.value > 0 ? allocEndPos.value + 1 : 0
      )
    );
  }
};

// 闪烁头像的函数
const blinkAvatar = (id: string) => {
  // 添加你的头像闪烁的逻辑
  console.log("头像闪烁", id);
};

/* 错误处理 */
const exitOnError = (err: string) => {
  ElMessage.error(`${err} 【即将返回首页!】`);
  cleanPlayer();
  setTimeout(() => {
    router.replace("/home");
  }, 1500);
};

const cleanPlayer = () => {
  noteRain.value.onStopRain();
  instrument?.releaseAll();
  midiCtx?.cleanPlayTimer();
};
</script>

<style scoped lang="scss">
@import "@/styles/co-op.scss";

.logo-rain {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  overflow: hidden;

  &-item {
    position: absolute;
    width: 460px;
    height: 400px;
    top: calc(50% - 300px);
    left: calc(50% - 225px);
    &:nth-child(1) {
      animation: logoAnimationLeft 3s 1;
      animation-fill-mode: forwards;
    }
    &:nth-child(2) {
      animation: logoAnimationRight 3s 1;
      animation-fill-mode: forwards;
    }
  }
}

.dialog-footer {
  text-align: center;
}

@keyframes logoAnimationLeft {
  0% {
    transform: rotate(0deg) scale(1);
    top: 0;
    left: 0;
    opacity: 0;
  }
  100% {
    transform: rotate(720deg) scale(0.5);
    top: calc(50% - 300px);
    left: calc(50% - 225px);
    opacity: 1;
  }
}

@keyframes logoAnimationRight {
  0% {
    transform: rotate(0deg) scale(1);
    top: 0;
    left: 100%;
    opacity: 0;
  }
  100% {
    transform: rotate(720deg) scale(0.5);
    top: calc(50% - 300px);
    left: calc(50% - 225px);
    opacity: 1;
  }
}
</style>
