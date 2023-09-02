import { ElMessage } from "element-plus";
import { Sampler, Synth, SamplerOptions, loaded, start } from "tone";
import { Time } from "tone/Tone/core/type/Units";

interface InstrumentConfig {
  [key: string]: Partial<SamplerOptions>;
}

const config: InstrumentConfig = {
  "Salamander piano": {
    urls: {
      A0: "A0.[mp3|ogg]",
      C1: "C1.[mp3|ogg]",
      "D#1": "Ds1.[mp3|ogg]",
      "F#1": "Fs1.[mp3|ogg]",
      A1: "A1.[mp3|ogg]",
      C2: "C2.[mp3|ogg]",
      "D#2": "Ds2.[mp3|ogg]",
      "F#2": "Fs2.[mp3|ogg]",
      A2: "A2.[mp3|ogg]",
      C3: "C3.[mp3|ogg]",
      "D#3": "Ds3.[mp3|ogg]",
      "F#3": "Fs3.[mp3|ogg]",
      A3: "A3.[mp3|ogg]",
      C4: "C4.[mp3|ogg]",
      "D#4": "Ds4.[mp3|ogg]",
      "F#4": "Fs4.[mp3|ogg]",
      A4: "A4.[mp3|ogg]",
      C5: "C5.[mp3|ogg]",
      "D#5": "Ds5.[mp3|ogg]",
      "F#5": "Fs5.[mp3|ogg]",
      A5: "A5.[mp3|ogg]",
      C6: "C6.[mp3|ogg]",
      "D#6": "Ds6.[mp3|ogg]",
      "F#6": "Fs6.[mp3|ogg]",
      A6: "A6.[mp3|ogg]",
      C7: "C7.[mp3|ogg]",
      "D#7": "Ds7.[mp3|ogg]",
      "F#7": "Fs7.[mp3|ogg]",
      A7: "A7.[mp3|ogg]",
      C8: "C8.[mp3|ogg]",
    },
    baseUrl: "/static/sampler/",
    release: 1,
    onload: () => {},
  },
};

export class CustomInstrument {
  name: string;
  sampler?: Sampler;
  synth?: Synth;
  caller?: Sampler | Synth;

  constructor(SAMPLER_NAME: string = "Salamander piano") {
    if (!!config[SAMPLER_NAME]) {
      this.sampler = new Sampler(config[SAMPLER_NAME]).toDestination();
    } else {
      this.synth = new Synth().toDestination();
    }
    this.name = SAMPLER_NAME;
    if (this.sampler || this.synth) {
      this.caller = this.sampler ? this.sampler : this.synth;
    } else {
      const errMsg = "创建音乐播放环境失败，可能您的浏览器暂不支持！";
      ElMessage.error(errMsg);
      throw new Error(errMsg);
    }
  }

  triggerAttack(note: string, time: Time = "+0", velocity = 0.6) {
    this.caller?.triggerAttack(note, time, velocity);
  }

  triggerAttackRelease(
    note: string,
    duration: number,
    time: Time = "+0",
    velocity = 0.5
  ) {
    this.caller?.triggerAttackRelease(note, duration, time, velocity);
  }

  triggerRelease(note: string, time: Time = "+0.1") {
    if (this.sampler) {
      this.sampler.triggerRelease(note, time);
    } else {
      this.synth?.triggerRelease(time);
    }
  }

  releaseAll() {
    this.sampler?.releaseAll();
  }
}

export function buildInstrumentAsync(SAMPLER_NAME: string, action?: Function) {
  const instrument = new CustomInstrument(SAMPLER_NAME);
  loaded().then(() => {
    start().then(() => {
      !!action && action(instrument);
    });
  });
}
