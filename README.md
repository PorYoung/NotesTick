# NotesTick

## 桌面应用

访问[程序发布](https://github.com/PorYoung/NotesTick/releases)下载最新编译的可执行程序使用。

## 页面

1. `solo`
2. `solo-hint`

## 使用方法

| solo page 参数 | 类型    | 介绍                              |
| -------------- | ------- | --------------------------------- |
| room           | string  | 房间名（默认 `"cgb"`）            |
| auto           | boolean | 是否完全自动播放                  |
| velocity       | float   | 音乐进行速度                      |
| midi           | string  | 音乐文件（默认 `"我爱你中国.mid"` |

## Test

1. 全自动(`auto=true`)，慢速(`velocity=0.3`)播放虫儿飞(`midi=虫儿飞.mid`)音乐，默认用户(`admin`)

```
http://localhost:8080/#/solo-hint?midi=虫儿飞.mid&velocity=0.3&auto=true
```
