import * as fs from "fs";
import * as express from "express";
import * as https from "https";
import * as http from "http";
import {Application} from "express";
import {viewers, segmenter, videoInfo} from "./constants";
import * as SocketIO from "socket.io";
import { indexRoute } from "./routes";
import { apiRoute } from "./routes/api";
import { Mp4Segmenter } from "./lib/Mp4Segmenter";
import {CERT_FOLDER, ORIGINS, PORT, PROTOCOL} from "./config";
import * as path from "path";
import { Message } from "./lib/Message";
import * as bodyParser from "body-parser";


const Server = PROTOCOL === "HTTPS" ? https.Server : http.Server;
const app: Application = express();
const server: https.Server | http.Server =  PROTOCOL === "HTTPS" ?
    new Server({
        key: fs.readFileSync(`/etc/letsencrypt/live/${CERT_FOLDER}/privkey.pem`),
        cert: fs.readFileSync(`/etc/letsencrypt/live/${CERT_FOLDER}/fullchain.pem`),
        ca: fs.readFileSync(`/etc/letsencrypt/live/${CERT_FOLDER}/chain.pem`)
    }, app) :
    new Server(app);
const io : SocketIO.Server = SocketIO(server,
    {
        origins: ORIGINS
    });
const mp4Segmenter = new Mp4Segmenter();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('io', io);
app.set(viewers, 0);
app.set(segmenter, mp4Segmenter);

let views: number = 0;
setInterval(() => {
    if (views === app.get(viewers)) return ;
    views = app.get(viewers);
    io.emit('viewers', views);
}, 2500);

const clients = new Set();


io.on('connection', socket => {
    console.log(new Date(Date.now()));
    //socket.emit('start', app.get(videoInfo));
    const mp4Seg: Mp4Segmenter = app.get(segmenter);
    app.set(viewers, app.get(viewers) + 1);
    console.log("User connected!", socket.id);
    socket.emit('viewers', app.get(viewers));
    let eliminacion = setTimeout(() => {
        socket.disconnect();
    }, 5000);
    let clientid: string;
    socket.on('clientId', (clientId) => {
        if (eliminacion) {
            clearTimeout(eliminacion);
            eliminacion = null;
        }
        const data = {
            videoData: app.get(videoInfo),
            initSegment: mp4Seg.initSegment
        };
        console.log(clientId);
        if (clients.has(clientId)) {
            console.log('Yala');
        } else {
            console.log('Nola');
            if (mp4Seg.initSegment !== null) socket.emit('start', data);
            clients.add(clientId);
        }
        clientid = clientId;
    });
    const emitData: ((data: Buffer) => void) = data => {
        console.log(`Emitiendo data al socket ${socket.id}`);
        socket.emit('data', data);
    };
    const emitMessage: ((message: Message) => void) = message => {
        console.log(message);
        io.emit('chatMessage', message);
    };

    if (mp4Seg.initSegment) setTimeout(() => emitData(mp4Seg.initSegment), 100);
    mp4Seg.on('data', emitData);
    socket.on('sendMessage', emitMessage);
    socket.on('disconnect', () => {
        if (clientid) clients.delete(clientid);
        socket.removeListener('data', emitData);
        socket.removeListener('sendMessage', emitMessage);
        console.log("User disconnected", socket.id);
        app.set(viewers, app.get(viewers) - 1);
        mp4Seg.removeListener('data', emitData);
    })

});

app.use('/public', express.static(path.resolve(__dirname, '../src/public')));

app.use('/', indexRoute);
app.use('/api', apiRoute);

server.listen(PORT, () => {
    console.log("Running");
});



