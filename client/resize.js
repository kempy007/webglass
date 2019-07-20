function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

var myEfficientFn = debounce(function() {
  width = window.innerWidth
  || document.documentElement.clientWidth
  || document.body.clientWidth;

  height = window.innerHeight
  || document.documentElement.clientHeight
  || document.body.clientHeight;
  requestResize(width-15, height-50);
}, 250);

function requestResize(width, height) {
    video.videoWidth = parseInt(width);
    video.videoHeight = parseInt(height);
    message = {
        command: "resize-window",
        width: width,
        height: height
    }
    console.log(message);
    ws.send(JSON.stringify(message));
}
function resize() {
    width = document.getElementById("width").value;
    height = document.getElementById("height").value;
    if(!isNaN(width) && !isNaN(height) && isFinite(width) && isFinite(height))
        requestResize(width, height);
}