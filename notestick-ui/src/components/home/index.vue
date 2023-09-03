<template>
  <div class="home">
    <h1>Notes Tick Music Game</h1>
    <!-- 模式选择 -->
    <el-row class="mode-selector" :gutter="20">
      <el-col :span="12">
        <h2>选择模式</h2>
        <h3>
          <router-link
            class="color-link"
            :to="`/co-op?name=${name}&room=${room}&midi=${selectedMidi}&velocity=${velocity}&maxKeys=${maxKeys}&auto=${auto}&fullScreen=${fullScreen}`"
            >Co-Op Game</router-link
          >
        </h3>
      </el-col>
      <el-col :span="12">
        <h2>当前游戏参数</h2>
        <el-form>
          <el-form-item label="用户名">
            <el-input v-model:value="name" placeholder="如：admin"></el-input>
          </el-form-item>
          <el-form-item label="房间名称">
            <el-input v-model:value="room" placeholder="房间名称"></el-input>
          </el-form-item>
          <el-form-item label="音乐名称">
            <el-input
              v-model:value="selectedMidi"
              placeholder="音乐名称"
            ></el-input>
          </el-form-item>
          <el-form-item label="游戏速度">
            <el-input
              v-model:value="velocity"
              placeholder="游戏速度(1为原速)"
            ></el-input>
          </el-form-item>
          <el-form-item label="最大按键数">
            <el-input
              v-model:value="maxKeys"
              placeholder="最大按键数(0~10)"
            ></el-input>
          </el-form-item>
          <el-form-item label="自动播放">
            <el-checkbox v-model="auto"></el-checkbox>
          </el-form-item>
          <el-form-item label="全屏模式">
            <el-checkbox v-model="fullScreen"></el-checkbox>
          </el-form-item>
        </el-form>
      </el-col>
    </el-row>
    <!-- 乐曲列表 -->
    <el-row class="midi-list">
      <h2>乐曲列表</h2>
      <el-row :gutter="2">
        <el-col :span="8" v-for="midi in midiList" :key="midi">
          <el-link
            type="primary"
            @click="
              () => {
                selectMidi(midi);
              }
            "
          >
            {{ midi }}
          </el-link>
        </el-col>
      </el-row>
    </el-row>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { ElNotification } from "element-plus";

export default defineComponent({
  name: "Home",
  data() {
    return {
      midiList: [],
      name: "admin",
      room: "cgb",
      selectedMidi: "qingtian.mid",
      maxKeys: "6",
      velocity: "1",
      auto: false,
      fullScreen: false,
    };
  },
  methods: {
    listMidi() {
      fetch("/api/v1/midis")
        .then((response) => response.json())
        .then((res) => {
          !!res.data && (this.midiList = res.data);
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    },
    selectMidi(name: string) {
      this.selectedMidi = name;
      ElNotification.success(`选择了音乐 ${name}`);
    },
  },
  mounted() {
    this.listMidi();
  },
});
</script>

<style lang="scss" scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  padding: 8px 0;
  text-align: left;
  > .el-row {
    border-top: 2px solid;
  }
}
</style>
