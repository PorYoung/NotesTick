const express = require("express");
const router = express.Router();
// 读取midi文件列表
const midiFileList = require("../utils/midiHelper").listAllMidi();

router.get("/v1/midis", (req, res) => {
	res.json({ data: midiFileList || [] });
});

module.exports = router;
