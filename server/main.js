const { app, BrowserWindow, screen, webFrame } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

const appName = app.getPath("exe");
const windowConfig = {
	productName: "NotesTick",
	appId: "NotesTick",
	title: "NotesTick",
	fullscreenable: true,
	fullscreen: false,
	autoHideMenuBar: true,
	width: 1920,
	height: 1080,
	show: false,
	icon: path.join(__dirname, "./static/images/favicon.ico"),
	webPreferences: {
		//解决跨域问题
		webSecurity: false,
	},
};
const expressPath = path.join(__dirname, "./server.js");
const expressUrl = "http://localhost:3000/app";

let mainWindow;

const stripAnsiColors = (text) => {
	return text.replace(
		/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
		""
	);
};

const redirectOutput = (stream) => {
	stream.on("data", (data) => {
		data.toString()
			.split("\n")
			.forEach((line) => {
				if (line !== "") {
					mainWindow.webContents.send(
						"server-log-entry",
						stripAnsiColors(line)
					);
				}
			});
	});
};

function createWindow() {
	const expressAppProcess = spawn(appName, [expressPath], {
		env: { ELECTRON_RUN_AS_NODE: "1" },
	});

	[expressAppProcess.stdout, expressAppProcess.stderr].forEach(
		redirectOutput
	);

	const size = screen.getPrimaryDisplay().workAreaSize;
	const width = size.width;
	if (width >= 1920) {
		mainWindow = new BrowserWindow(windowConfig);
	} else {
		let height = parseInt((1080 * size.width) / 1920 + 30);
		mainWindow = new BrowserWindow(
			Object.assign({}, windowConfig, { width: width, height: height })
		);
	}

	mainWindow.maximize();

	mainWindow.loadURL(expressUrl);

	mainWindow.on("closed", function () {
		mainWindow = null;
	});

	mainWindow.once("ready-to-show", () => {
		mainWindow.show();
	});
}

app.on("ready", createWindow);
app.on("window-all-closed", () => {
	app.quit();
});
app.on("activate", () => {
	if (win == null) {
		createWindow();
	}
});
