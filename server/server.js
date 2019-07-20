const {desktopCapturer} = require('electron')
const EventEmitter = require('events');
const {ipcRenderer} = require('electron')
const fs = require('fs')
var socketId = null;
var windowId = null;
var otherConfig;
var windowStreamer;
socketId = require('electron').remote.getCurrentWindow().getTitle();
windowId = socketId;

ipcRenderer.send('async', JSON.stringify("Entered Rendering"));

class WindowStreamer extends EventEmitter {
    constructor(windowId) {
        super();      
        this.offerOptions = {
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1
        }
        this.peer = new RTCPeerConnection(null); 
        this.sdp = null;
        this.icecandidates = [];
        let that = this;
        desktopCapturer.getSources({types: ['window', 'screen']}, (error, sources) => {
            ipcRenderer.send('async', JSON.stringify('Entered Desktop Capturer'));
            if (error) {
                ipcRenderer.send('async', JSON.stringify("Error while requesting for window sources: " + error));
                console.log("Error while requesting for window sources: " + error)
                throw error
            } else {
                ipcRenderer.send('async', JSON.stringify("Sources length: "+sources.length)); 
                for (let i = 0; i < sources.length; ++i) {
                    ipcRenderer.send('async', JSON.stringify("Source Name: " + sources[i].name +", Source ID: "+sources[i].id+", WindowId: " + windowId));
                    if (sources[i].name === windowId) { 
                        ipcRenderer.send('async', JSON.stringify('Got the window'));
                        navigator.mediaDevices.getUserMedia({
                            audio: false,        
                            video: {
                                mandatory: {
                                    chromeMediaSource: 'desktop', 
                                    chromeMediaSourceId: sources[i].id, 
                                    minWidth: 800,
                                    maxWidth: 1921,
                                    minHeight: 600,
                                    maxHeight: 1081
                                }
                            }
                        })
                        .then(stream => that.handleStream(stream))
                        .catch(e => ipcRenderer.send('async',JSON.stringify("Error while trying to access window " + windowId + " video source. " + e)))
                    } 
                    ipcRenderer.send('async', JSON.stringify('Finished Checking Windows.'));
                }
            }
        })
    }
    handleStream(stream) {
        ipcRenderer.send('async',JSON.stringify('Got a stream.'));
        this.peer.addStream(stream);
        this.peer.onicecandidate = e => this.icecandidates.push(e.candidate);
        let that = this;
        this.peer.createOffer(this.offerOptions).then(desc=> {
            that.sdp = desc;
            that.peer.setLocalDescription(desc);
            setTimeout(that.monitorGatheringState, 100);
        }, e => ipcRenderer.send('async',JSON.stringify("Error while creating RTC offer: " + e)));
    }
    setClientConfig (config) {
        ipcRenderer.send('async',JSON.stringify("Set Client Config."));
        config = JSON.parse(config);
        let that = this;
        this.peer.setRemoteDescription(config.sdp);
        config.icecandidates.forEach(candidate => {
            if(candidate != null || candidate != undefined) {
                let rtcicecandidate = new RTCIceCandidate(candidate);
                that.peer.addIceCandidate(rtcicecandidate)
                .then(s => {}, e => ipcRenderer.send('async', JSON.stringify('Error whileadding RTCIceCandidate ' + e)))

            }
        })
        let message = { 
            socketId: socketId
        }
        ipcRenderer.send('ready', JSON.stringify(message));
    }
    monitorGatheringState() {
        ipcRenderer.send('async', JSON.stringify('State: ' + windowStreamer.peer.iceGatheringState ));
        console.log('State: ' + windowStreamer.peer.iceGatheringState);
        if(windowStreamer.peer.iceGatheringState == "complete") {
            windowStreamer.emit("ice-gathering-completed", windowStreamer.sdp, windowStreamer.icecandidates);
            let message = { 
                socketId: socketId,
                config: {
                    sdp: windowStreamer.sdp, 
                    icecandidates: windowStreamer.icecandidates
                }
            }
            ipcRenderer.send('server-webrtc-ready', JSON.stringify(message));
        } else {
            setTimeout(windowStreamer.monitorGatheringState, 100);
        }
    }
}


ipcRenderer.on('client-webrtc-config', (event, data) => {
    otherConfig = data;
    windowStreamer.setClientConfig(otherConfig);
})

ipcRenderer.send('async', JSON.stringify('Instantiating Class'));
windowStreamer = new WindowStreamer(windowId);
