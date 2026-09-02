const CARD_EFFECTS = {
  1: "10に勝つ", 2: "小が勝ち", 3: "相手pt0", 4: "相手pt-1", 5: "次回+2",
  6: "勝つと+2pt", 7: "全無効化", 8: "基本12", 9: "次回分け", 10: "2を無視"
};

let gameMode = 'cpu'; // 'cpu' または 'online'
let peer = null;
let conn = null;

let pHand = [], cHand = [];
let pScore = 0, cScore = 0;
let currentRound = 1;

let pNextBonus = 0, cNextBonus = 0;
let isForceDrawNext = false;

// オンライン同期用
let myChoice = null;
let oppChoice = null;

function selectMode(mode) {
  gameMode = mode;
  document.getElementById('btnCpuMode').classList.toggle('active', mode === 'cpu');
  document.getElementById('btnOnlineMode').classList.toggle('active', mode === 'online');
  document.getElementById('onlinePanel').style.display = mode === 'online' ? 'block' : 'none';
  document.getElementById('startBtn').style.display = mode === 'cpu' ? 'block' : 'none';
}

// 部屋作成（ホスト）
function createRoom() {
  const statusEl = document.getElementById('connectionStatus');
  statusEl.textContent = "ID発行中...";

  // ランダムな4桁IDを生成
  const roomId = 'cards-' + Math.floor(1000 + Math.random() * 9000);
  peer = new Peer(roomId);

  peer.on('open', (id) => {
    const display = document.getElementById('roomIdDisplay');
    display.style.display = 'block';
    display.textContent = `ルームID: ${id}`;
    statusEl.textContent = "対戦相手の接続を待っています...";
  });

  peer.on('connection', (connection) => {
    conn = connection;
    setupConnection();
    statusEl.textContent = "相手が接続しました！ゲームを開始します...";
    setTimeout(startGame, 1000);
  });
}

// 部屋参加（ゲスト）
function joinRoom() {
  const roomId = document.getElementById('joinRoomId').value.trim();
  const statusEl = document.getElementById('connectionStatus');
  if (!roomId) {
    alert("ルームIDを入力してください");
    return;
  }

  statusEl.textContent = "接続中...";
  peer = new Peer();

  peer.on('open', () => {
    conn = peer.connect(roomId);
    setupConnection();
  });
}

function setupConnection() {
  conn.on('open', () => {
    document.getElementById('connectionStatus').textContent = "接続完了！対戦を開始します...";
    setTimeout(startGame, 1000);
  });

  conn.on('data', (data) => {
    if (data.type === 'CARD_PLAYED') {
      oppChoice = data.card;
      checkRoundResolve();
    }
  });

  conn.on('close', () => {
    alert("対戦相手との通信が切断されました。");
    goToStart();
  });
}

function startGame() {
  document.getElementById('startScreen').classList.remove('active');
  document.getElementById('gameScreen').classList.add('active');

  const isOnline = gameMode === 'online';
  document.getElementById('oppName').textContent = isOnline ? 'PLAYER 2' : 'CPU';
  document.getElementById('oppCardLabel').textContent = isOnline ? 'PLAYER 2' : 'CPU';

  resetGame();
}

function goToStart() {
  if (peer) peer.destroy();
  document.getElementById('gameScreen').classList.remove('active');
  document.getElementById('startScreen').classList.add('active');
}

function resetGame() {
  pHand = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  cHand = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  pScore = 0; cScore = 0;
  currentRound = 1;
  pNextBonus = 0; cNextBonus = 0;
  isForceDrawNext = false;
  myChoice = null; oppChoice = null;

  document.getElementById('pScore').textContent = '0';
  document.getElementById('cScore').textContent = '0';
  document.getElementById('turnNum').textContent = '1';
  document.getElementById('pCardSlot').textContent = '-';
  document.getElementById('cCardSlot').textContent = '-';
  document.getElementById('pEffectDesc').textContent = '';
  document.getElementById('cEffectDesc').textContent = '';
  document.getElementById('resultMsg').textContent = 'カードを選択してください';

  renderHand();
}

function renderHand() {
  const container = document.getElementById('playerHand');
  container.innerHTML = '';
  pHand.forEach(num => {
    const btn = document.createElement('button');
    btn.className = 'card-btn';
    btn.innerHTML = `<span class="card-num">${num}</span><span class="card-desc">${CARD_EFFECTS[num]}</span>`;
    
    // 選択済みならボタン無効化
    if (myChoice !== null) btn.disabled = true;

    btn.onclick = () => selectCard(num);
    container.appendChild(btn);
  });
}

function selectCard(pChoice) {
  myChoice = pChoice;
  pHand = pHand.filter(n => n !== pChoice);
  renderHand();

  if (gameMode === 'cpu') {
    const cIndex = Math.floor(Math.random() * cHand.length);
    oppChoice = cHand.splice(cIndex, 1)[0];
    resolveRound();
  } else {
    // オンライン戦：自分のカード選択を送信
    conn.send({ type: 'CARD_PLAYED', card: pChoice });
    document.getElementById('resultMsg').textContent = "相手の選択を待っています...";
    checkRoundResolve();
  }
}

function checkRoundResolve() {
  if (myChoice !== null && oppChoice !== null) {
    resolveRound();
  }
}

function resolveRound() {
  let pBase = myChoice;
  let cBase = oppChoice;

  let pReal = pBase + pNextBonus;
  let cReal = cBase + cNextBonus;

  const pAppliedBonus = pNextBonus;
  const cAppliedBonus = cNextBonus;
  pNextBonus = 0; cNextBonus = 0;

  if (pBase === 8) pReal = 12 + pAppliedBonus;
  if (cBase === 8) cReal = 12 + cAppliedBonus;

  let pEffectActive = (cBase !== 7);
  let cEffectActive = (pBase !== 7);

  document.getElementById('pCardSlot').textContent = pReal;
  document.getElementById('cCardSlot').textContent = cReal;

  let pDesc = pBase === 8 ? '【8】基本12' : `【${pBase}】${CARD_EFFECTS[pBase]}`;
  let cDesc = cBase === 8 ? '【8】基本12' : `【${cBase}】${CARD_EFFECTS[cBase]}`;
  if (pAppliedBonus > 0) pDesc += ' (+2)';
  if (cAppliedBonus > 0) cDesc += ' (+2)';
  document.getElementById('pEffectDesc').textContent = pDesc;
  document.getElementById('cEffectDesc').textContent = cDesc;

  let resultMsg = "";

  if (isForceDrawNext) {
    resultMsg = "前回の9効果により【強制引き分け】";
    isForceDrawNext = false;
  } else {
    let winner = null;

    let isSmallWins = false;
    if ((pBase === 2 && pEffectActive) || (cBase === 2 && cEffectActive)) {
      isSmallWins = true;
      if ((pBase === 10 && pEffectActive) || (cBase === 10 && cEffectActive)) {
        isSmallWins = false;
      }
    }

    let pOneSpecial = (pBase === 1 && pEffectActive && cBase === 10 && cEffectActive);
    let cOneSpecial = (cBase === 1 && cEffectActive && pBase === 10 && pEffectActive);

    if (pOneSpecial && !cOneSpecial) {
      winner = 'P';
      resultMsg = "1の効果発動！10に勝利！";
    } else if (cOneSpecial && !pOneSpecial) {
      winner = 'C';
      resultMsg = "相手の1の効果発動！10に勝利！";
    } else {
      if (pReal === cReal) {
        winner = 'DRAW';
        resultMsg = "引き分け！";
      } else if (isSmallWins) {
        winner = pReal < cReal ? 'P' : 'C';
        resultMsg = `2の効果適用：${winner === 'P' ? 'あなたの勝ち！' : '相手の勝ち'}`;
      } else {
        winner = pReal > cReal ? 'P' : 'C';
        resultMsg = `${winner === 'P' ? 'あなたの勝ち！' : '相手の勝ち'}`;
      }
    }

    if (winner === 'P') {
      let addPt = (pBase === 6 && pEffectActive) ? 2 : 1;
      if (cBase === 3 && cEffectActive) addPt = 0;
      pScore += addPt;
      if (pBase === 4 && pEffectActive) cScore -= 1;
    } else if (winner === 'C') {
      let addPt = (cBase === 6 && cEffectActive) ? 2 : 1;
      if (pBase === 3 && pEffectActive) addPt = 0;
      cScore += addPt;
      if (cBase === 4 && cEffectActive) pScore -= 1;
    }
  }

  if (pBase === 5 && pEffectActive) pNextBonus = 2;
  if (cBase === 5 && cEffectActive) cNextBonus = 2;
  if ((pBase === 9 && pEffectActive) || (cBase === 9 && cEffectActive)) {
    isForceDrawNext = true;
  }

  document.getElementById('resultMsg').textContent = resultMsg;
  document.getElementById('pScore').textContent = pScore;
  document.getElementById('cScore').textContent = cScore;

  // 次ターンへのリセット処理
  myChoice = null;
  oppChoice = null;

  if (currentRound === 10) {
    setTimeout(() => {
      let finalMsg = pScore > cScore ? `【ゲーム終了】あなたの勝利！ (${pScore} vs ${cScore})`
                   : pScore < cScore ? `【ゲーム終了】相手の勝利… (${pScore} vs ${cScore})`
                   : `【ゲーム終了】引き分け！ (${pScore} vs ${cScore})`;
      alert(finalMsg);
    }, 300);
  } else {
    currentRound++;
    document.getElementById('turnNum').textContent = currentRound;
    renderHand();
  }
}
