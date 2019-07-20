var isChrome = !!window.chrome && !!window.chrome.webstore;
console.log('Is Chrome: '+isChrome.toString())
if(isChrome) {}
else { alert('Please try to use Chrome Browser while we try to hunt bugs')}