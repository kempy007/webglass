const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path')
const sha256 = require('sha256');
const fs = require('fs');
const http = require("http");
const crypto = require("crypto");
const EventEmitter = require('events');
const uuidv4 = require('uuid/v4');
const WebSocket = require('ws');


var os = require('os');
var networkInterfaces = os.networkInterfaces(); 
console.log(networkInterfaces);

var wsBindPort = 8080; 


const defaultWidth = 800;
const defaultHeight = 600;
let wins = [];
let sockets = [];
let views = [];

var totalSessions = 0;


const wss = new WebSocket.Server({
    port: wsBindPort ,
    perMessageDeflate: {
        zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3,
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true, 
        serverNoContextTakeover: true, 
        clientMaxWindowBits: 10, 
        serverMaxWindowBits: 10, 
        concurrencyLimit: 10, 
        threshold: 1024, 
    } 
});



app.disableHardwareAcceleration()
function boot() {
    wss.on('connection', function connection(ws) {
        let win = null;
        socketId = sha256(uuidv4());
        console.log('Connection on ' + socketId);
        sockets[socketId] = ws;
        win = new BrowserWindow({ show: false, frame: false, title: socketId, width: defaultWidth, height: defaultHeight, acceptFirstMouse: true }); 
        win.on('page-title-updated', event => {
            event.preventDefault();
        }) 
        win.setTitle(socketId); 
        win.loadFile('server.html');
        win.show();
        
        let view = new BrowserView();
        
        win.setBrowserView(view);
        view.setBounds({ x: 0, y: 0, width: defaultWidth-10, height: defaultHeight-10}); 
        view.setAutoResize({width: true, height: true});
        
        view.webContents.loadURL('https://www.duckduckgo.com');
        view.webContents.focus();
        console.log('View has focus: '+view.webContents.isFocused());
        

        wins[socketId] = win;
        views[socketId] = view;

        ws.on('open', function open() {
            console.log('Websocket opened for '+socketId);
            totalSessions++;
        })
        ws.on('close', e => {
            console.log('Connection '+socketId+' closed.');
            totalSessions--;
            views[socketId] = null;
            view.destroy();
            view = null
            wins[socketId] = null;
            win.close();
            win = null;
        })
        ws.on('message', message => {
            message = JSON.parse(message);
            switch(message.command) {
                case "webrtc-config":
                    win.webContents.send('client-webrtc-config', JSON.stringify(message.config));
                    break;
				case "keypress":
                    view.webContents.focus();
                    if(message.keyCode.length == 1)
                        view.webContents.sendInputEvent({ type: 'char', keyCode: message.keyCode, modifiers: message.modifiers});
                    else  {
                        view.webContents.sendInputEvent({
                            type: "keyDown",
                            keyCode: String.fromCharCode(message.code)
                          });

                          view.webContents.sendInputEvent({
                            type: "keyUp",
                            keyCode: String.fromCharCode(message.code)
                          });
                        console.log(message)
                    }
					break;
                case "resize-window":
                    try {
                        let w = parseInt(message.width)
                        let h = parseInt(message.height)
                        win.setSize(w, h)

                    } catch (e) {

                    }
                    break;
                case "keyDown":
                    view.webContents.focus();
					if(message.keyCode.length == 1) {
                        view.webContents.sendInputEvent({ type: 'keyDown', keyCode: message.keyCode, modifiers: message.modifiers});
                    }
					else {
                        view.webContents.sendInputEvent({ type: 'keyDown', keyCode: String.fromCharCode(message.code), modifiers: message.modifiers});
                    }
					break;
                case "keyUp":
                    view.webContents.focus();
					if(message.keyCode.length == 1) {
                        view.webContents.sendInputEvent({ type: 'keyUp', keyCode: message.keyCode, modifiers: message.modifiers});
                    }
					else {
                        view.webContents.sendInputEvent({ type: 'keyUp', keyCode: String.fromCharCode(message.code), modifiers: message.modifiers});
                    }
                    break;
                case "mousewheel":
                    view.webContents.sendInputEvent({ type: 'mouseWheel', x: message.x, y: message.y, deltaY: message.deltaY, deltaX: message.deltaX, canScroll: true, hasPreciseScrollingDeltas: true });
                    break;
                case "click":
                    view.webContents.focus();
                    message.x = message.x / message.width * win.getSize()[0]
                    message.y = message.y / message.height * win.getSize()[1]
                    view.webContents.sendInputEvent({ type: 'mouseDown', x: message.x, y: message.y, button: message.button, clickCount: 1 })
                    view.webContents.sendInputEvent({ type: 'mouseUp', x: message.x, y: message.y, button: message.button, clickCount: 1 })
                    break;
                case "mousedown":
                    message.x = message.x / message.width * win.getSize()[0]
                    message.y = message.y / message.height * win.getSize()[1]
                    view.webContents.sendInputEvent({ type: 'mouseDown', x: message.x, y: message.y, button: message.button, clickCount: 1 })
                    break;
                case "mousemove":
                    message.x = message.x / message.width * win.getSize()[0]
                    message.y = message.y / message.height * win.getSize()[1]
                    view.webContents.sendInputEvent({ type: 'mouseMove', x: message.x, y: message.y, button: message.button, clickCount: 1 })
                    break;
                case "mouseup":
                    message.x = message.x / message.width * win.getSize()[0]
                    message.y = message.y / message.height * win.getSize()[1]
                    view.webContents.sendInputEvent({ type: 'mouseUp', x: message.x, y: message.y, button: message.button, clickCount: 1 })
                    break;
                case "mouseout":
                    win.blur();
                    break;
                case "mouseenter":
                    view.webContents.focus();
                    break;
            }
        });
        console.log(totalSessions.toString())
    })
}

ipcMain.on('server-webrtc-ready', (event, data) => {
    data = JSON.parse(data);
    let socketId = data.socketId;
    console.log('Streaming server prepared webrtc config for socketId: ' + socketId + '.')
    let config = data.config;
    let message = {
        command: "webrtc-config",
        config: data.config
    }
    sockets[socketId].send(JSON.stringify(message));
})
ipcMain.on('ready', (event, data) => {
    data = JSON.parse(data);
    let socketId = data.socketId;
    console.log('Streaming for socketId ' +socketId+ ' is ready.');
    let message = {
        command: "ready"
    }
    sockets[socketId].send(JSON.stringify(message));
})


ipcMain.on('async', (event, arg) => {
   console.log(arg);
});
app.on('ready', boot);
app.on('window-all-closed', e => {
    e.preventDefault();
})
