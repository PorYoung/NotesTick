const crypto = require("crypto");
const config = require("../config");

/**
 * 头像生成
 * @param {*} username
 * @returns
 */
function generateAvatar(username) {
	return config.DEFAULT_AVATAR;
}

/**
 * UID生成
 * @param {*} username
 * @returns
 */
function generateUniqueId(username) {
	const hash = crypto.createHash("md5").update(username).digest("hex");
	return hash;
}

module.exports = {
	generateAvatar,
	generateUniqueId,
};
