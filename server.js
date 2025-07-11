// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Express で public フォルダを静的ファイルとして配信
const app = express();
// app.use(express.static('public'));
app.get('/',(req,res) => {
  res.send('Hello World!');
});

const server = http.createServer(app);
const io = new Server(server);

// ルームごとにプレイヤー情報（進捗・所要時間）を管理
const rooms = {};

// 日本語テキスト例
const texts = [
  "速く正確にタイピングしましょう。",
  "Socket.io を使うとリアルタイム通信が簡単です。",
  "タイプバトルで勝利を目指そう！",
  "JavaScript で楽しくプロジェクトを構築！"
];
function generateText() {
  return texts[Math.floor(Math.random() * texts.length)];
}

io.on('connection', socket => {
  let currentRoom = null;

  // ルーム参加／作成
  socket.on('join_room', roomId => {
    currentRoom = roomId;
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { players: {} };
    }
    rooms[roomId].players[socket.id] = { progress: 0, time: 0 };

    // プレイヤーが2人揃ったら対戦開始
    const count = Object.keys(rooms[roomId].players).length;
    if (count === 2) {
      const text = generateText();
      io.to(roomId).emit('start', { text });
    }
  });

  // 進捗＆経過時間を受信
  socket.on('progress', ({ progress, time }) => {
    if (!currentRoom) return;
    const room = rooms[currentRoom];
    room.players[socket.id].progress = progress;
    room.players[socket.id].time = time;

    // 全員の進捗をブロードキャスト
    const players = Object.entries(room.players).map(([id, info]) => ({
      id, progress: info.progress, time: info.time
    }));
    io.to(currentRoom).emit('update', players);

    // 両者100%到達で勝敗判定
    if (players.every(p => p.progress >= 100)) {
      const [a, b] = players;
      const winner = a.time < b.time ? a.id : b.id;
      io.to(currentRoom).emit('finish', { winner });
      delete rooms[currentRoom];
    }
  });

  // 切断時のルームクリーニング
  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = rooms[currentRoom];
    if (!room) return;
    delete room.players[socket.id];
    if (Object.keys(room.players).length === 0) {
      delete rooms[currentRoom];
    }
  });
});

const PORT = 10000;
server.listen(PORT, () => {
  console.log(`サーバーを http://localhost:${PORT} で起動しました`);
});
