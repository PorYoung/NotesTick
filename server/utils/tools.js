const config = require("../config");
function generateAvatar(username) {
	return config.DEFAULT_AVATAR;
}

module.exports = {
	generateAvatar,
};
