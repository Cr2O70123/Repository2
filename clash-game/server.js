const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 設定靜態檔案目錄 (public 資料夾)
app.use(express.static(path.join(__dirname, 'public')));

// 簡單的配對隊列
let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 玩家請求尋找對手
    socket.on('find_match', (data) => {
        if (waitingPlayer) {
            // 配對成功
            const roomID = `room_${waitingPlayer.id}_${socket.id}`;
            const opponent = waitingPlayer;
            
            // 將兩名玩家加入房間
            socket.join(roomID);
            opponent.join(roomID);

            // 通知雙方遊戲開始
            io.to(roomID).emit('game_start', { 
                roomID: roomID,
                startVal: Math.random() // 用於同步隨機種子或先後手
            });

            console.log(`Match started: ${opponent.id} vs ${socket.id}`);
            waitingPlayer = null; // 清空隊列
        } else {
            // 沒有人在排隊，將自己加入隊列
            waitingPlayer = socket;
            console.log(`Player waiting: ${socket.id}`);
            
            // 設定一個超時，如果太久沒人排隊，通知前端切換為 AI 模式
            setTimeout(() => {
                if (waitingPlayer === socket) {
                    socket.emit('no_match_found'); // 前端收到這個會啟動 AI
                    waitingPlayer = null;
                }
            }, 5000); // 5秒後沒人就打電腦
        }
    });

    // 處理遊戲內的動作轉發 (下兵、表情)
    socket.on('action', (data) => {
        // data 應該包含: roomID, type, card, x, y 等
        // 廣播給房間內除了自己以外的人 (to -> broadcast)
        socket.to(data.roomID).emit('remote_action', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }
        // 這裡可以增加通知對手「對方斷線」的邏輯
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});