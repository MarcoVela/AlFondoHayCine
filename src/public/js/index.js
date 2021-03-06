const socket = io({ transports: ['polling', 'websocket'], reconnection: false });
const video = document.getElementById("mse");
let mediaSource = new MediaSource(), sourceBuffer, bufferado = 0;
let user;
function appendData(data) {
    if (sourceBuffer) {
        if (sourceBuffer.updating) {
            console.log("Vamo a esperar unas fracciones de segundo a ver si funciona");
            console.log("Porque ahora no esta funcionando u.u");
            return setTimeout(() => appendData(data), 100);
        }
        return sourceBuffer.appendBuffer(new Uint8Array(data));
    }

    setTimeout(() => appendData(data), 100);
    console.log("No hay source buffer, Marco pedazo de animal");
}
video.onseeking = function () {
    if (video.currentTime > bufferado - 10)
        video.currentTime = bufferado - 10;
};

socket.on('reconnect_attempt', () => {
    socket.io.opts.transports = ['polling', 'websocket'];
});

const mime = 'video/mp4; codecs="avc1.4D0029, mp4a.40.2"';
if (!MediaSource.isTypeSupported(mime))
    alert("Dispositivo no soportado u.u");

socket.on('start', (initData) => {
    if (initData) prepare();
    initData = initData || {};
    initStream(initData);
});
socket.on('viewers', (viewerCount) => {
    const viewers = document.getElementById('Contador');
    viewers.innerText = "Viendo ahora:\t" + viewerCount;
});

socket.on('finish', () => alert('Transmision en vivo terminada.'));
socket.on('message', console.log);


const mensajeria = document.getElementById('comentario');
mensajeria.addEventListener('keyup', (e) => {
    if (e.key === 'Enter' && mensajeria.value.length > 0) {
        const mensaje = {
            userId: user,
            message: mensajeria.value
        };
        socket.emit('sendMessage', mensaje);
        mensajeria.value = '';
    }
});



let prepared = false;
function prepare () {
    video.src = URL.createObjectURL(mediaSource);
    if (!prepared) {
        socket.on('data', appendData);
        mediaSource.addEventListener('sourceopen', sourceOpen);
        mediaSource.addEventListener('sourceclose', sourceClose);
    }
    prepared = true;

    function sourceOpen() {
        console.log("Source open!", mediaSource.readyState);
        sourceBuffer = mediaSource.addSourceBuffer(mime);
        sourceBuffer.mode = 'sequence';
        sourceBuffer.addEventListener('updateend', () => {
            const buff = video.buffered;
            bufferado = buff.length ? buff.end(buff.length - 1) : 0;
            mediaSource.duration = bufferado;
        })
    }
    function sourceClose() {
        console.log("Source closed!");
    }
}
function initStream(initData) {
    user = initData.userId || 'Usuario';
    const title = document.getElementById('titulo');
    title.innerText = 'La dirección de Cultura presenta: ' + (initData.title || '');
}
