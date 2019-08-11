var width;
var height;
var streamReady;

width = window.innerWidth 
  || document.documentElement.clientWidth
  || document.body.clientWidth;

height = window.innerHeight
  || document.documentElement.clientHeight
  || document.body.clientHeight;

var my2ndEfficientFn = debounce(function() {
    if(streamReady==true){
        console.log("Video.play")
        video.play();   
    }
}, 1000);

window.addEventListener('resize', myEfficientFn);

var mainstream = new MediaStream();
var video = document.getElementById('video');
var command = {};
var client = null;
var listeners = [];
function sendMouseEvent(event) {
    console.log("Is stream ready: "+streamReady)
    
    command = {
        command: event.type,
        x: event.layerX,
        y: event.layerY,
        width: video.videoWidth,
        height: video.videoHeight,
        button: event.button
    }
    ws.send(JSON.stringify(command));
}

function sendMouseEventAlt(event) {
    command = {
        command: event.type,
        x: event.layerX,
        y: event.layerY,
        deltaX: event.deltaX,
        deltaY: -event.deltaY,
        width: video.videoWidth,
        height: video.videoHeight, 
        button: event.button
    }
    ws.send(JSON.stringify(command));
}

function sendKeydownEvent(event) {
    console.log(event)
    if(event.key=="F4"){ console.log("F4 Pressed"); sendFunctionKeyEvent(event);}
    var modifiers = [];
    if(event.altKey) modifiers.push("alt");
    if(event.ctrlKey) modifiers.push("ctrl");
    if(event.metaKey) modifiers.push("meta");
    if(event.shiftKey) modifiers.push("shift");
    command = {
        command: "keypress",
        keyCode: event.key,
        code: event.keyCode,
        modifiers: modifiers
    }
    ws.send(JSON.stringify(command));
}

function sendFunctionKeyEvent(event) {
    command = {
        command: "functionkey",
        keyCode: event.key,
        code: event.keyCode,
        modifiers: ""
    }
    ws.send(JSON.stringify(command));
}

ws.onopen = function(event) {
    listeners.push(video.addEventListener('mousedown', sendMouseEvent, false));
    listeners.push(video.addEventListener('mouseup', sendMouseEvent, false));
    listeners.push(video.addEventListener('mousemove', sendMouseEvent, false));
    listeners.push(video.addEventListener('mousemove', my2ndEfficientFn, false));
    listeners.push(video.addEventListener('mouseenter', sendMouseEvent, false));
    listeners.push(video.addEventListener('mousewheel', sendMouseEventAlt, false));
    listeners.push(document.addEventListener('keydown', sendKeydownEvent, false));
}
ws.onmessage = function(event) {
    var msg = JSON.parse(event.data);
    console.log(msg);
    switch(msg.command) {
        case "webrtc-config":
            console.log("webrtc-config");
            client = new StreamClient(msg.config);
            break;
        case "ready":
            video.srcObject = client.getStream();
            streamReady = true;
            requestResize(width-15, height-50);
            break;
    }
}

function clearListeners(item) {
    video.removeEventListener(item);
    document.removeEventListener(item);
}

ws.onclose = function(event) {
    console.log("Connection closed...")
    listeners.forEach(clearListeners)
}


function StreamClient(config) {
    console.log("Stream open...")
    let that = this;
    this.offerOptions = {}
    this.peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]});
    this.peer.setConfiguration({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]});  
    this.peer.onicecandidate = function(e) {that.icecandidates.push(e.candidate);}
    this.sdp = null;
    this.icecandidates = [];
    this.peer.setRemoteDescription(config.sdp);
    this.peer.createAnswer().then(desc => {
        that.peer.setLocalDescription(desc);
        that.sdp = desc;
        config.icecandidates.forEach( function(candidate) {
            if(candidate != null || candidate != undefined) {
                let rtcicecandidate = new RTCIceCandidate(candidate);
                that.peer.addIceCandidate(rtcicecandidate)
                .then( function(s) {}, function(e) {console.log('Error whileadding RTCIceCandidate ' + e) } )
            }
        })
        setTimeout(this.monitorGatheringState, 500);
    })
}
StreamClient.prototype.getStream = function () {
    return this.peer.getRemoteStreams()[0];
}
StreamClient.prototype.monitorGatheringState = function () {
    console.log(client.peer.iceGatheringState);
    if(client.peer.iceGatheringState == "complete") {
        let message = {
                command: "webrtc-config",
                config: {
                    sdp: client.sdp,
                    icecandidates: client.icecandidates
                }
            }
            console.log("Ready!");
        ws.send(JSON.stringify(message));
    } else {
        setTimeout(client.monitorGatheringState, 100);
    }
}
