// Firebaseの設定情報（ご自身のFirebase Consoleの設定値に差し替えてください）
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase初期化
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;

// 効果マスターデータ
const EFFECT_MASTER = {
  "DEF_1": { name: "10に勝つ", desc: "10に勝つ(8無効)", rarity: "DEF", penalty: 0, code: "DEF_1" },
  "DEF_2": { name: "小が勝ち", desc: "この回のみ小さい方が勝利", rarity: "DEF", penalty: 0, code: "DEF_2" },
  "DEF_3": { name: "相手pt0", desc: "負けても相手pt増えない", rarity: "DEF", penalty: 0, code: "DEF_3" },
  "DEF_4": { name: "相手pt-1", desc: "勝つと相手pt -1", rarity: "DEF", penalty: 0, code: "DEF_4" },
  "DEF_5": { name: "次回+2", desc: "次回自分の数字+2", rarity: "DEF", penalty: 0, code: "DEF_5" },
  "DEF_6": { name: "勝つと+2pt", desc: "勝つと獲得pt +2", rarity: "DEF", penalty: 0, code: "DEF_6" },
  "DEF_7": { name: "全無効化", desc: "相手効果を無効化", rarity: "DEF", penalty: 0, code: "DEF_7" },
  "DEF_8": { name: "基本12", desc: "数字12扱い", rarity: "DEF", penalty: 0, code: "DEF_8" },
  "DEF_9": { name: "次回分け", desc: "次回強制引き分け", rarity: "DEF", penalty: 0, code: "DEF_9" },
  "DEF_10": { name: "2を無視", desc: "2の効果を無視する", rarity: "DEF", penalty: 0, code: "DEF_10" },

  "N_1": { name: "ドロー獲得", desc: "引き分け時自分だけ1pt獲得", rarity: "N", penalty: 0, code: "N_1" },
  "N_2": { name: "偶数アンチ", desc: "相手が偶数なら自分の数字+3", rarity: "N", penalty: 1, code: "N_2" },
  "N_3": { name: "奇数アンチ", desc: "相手が奇数なら自分の数字+3", rarity: "N", penalty: 1, code: "N_3" },
  "N_4": { name: "シールド", desc: "相手の勝利時追加効果無効", rarity: "N", penalty: 1, code: "N_4" },
  "N_5": { name: "判定無効", desc: "勝敗判定を行わず消化", rarity: "N", penalty: 0, code: "N_5" },

  "R_1": { name: "ダブルアップ", desc: "勝利時獲得ptが2ptになる", rarity: "R", penalty: 2, code: "R_1" },
  "R_2": { name: "10ハンター", desc: "相手が10を出せば自分+1pt", rarity: "R", penalty: 1, code: "R_2" },
  "R_3": { name: "土壇場パワー", desc: "負けている時自分の数字+5", rarity: "R", penalty: 2, code: "R_3" },
  "R_4": { name: "数字デバフ", desc: "相手のカード数字 -3", rarity: "R", penalty: 1, code: "R_4" },
  "R_5": { name: "手札リサイクル", desc: "勝つと使用済み手札1枚回収", rarity: "R", penalty: 2, code: "R_5" },
  "R_6": { name: "カード封印", desc: "勝つと相手手札1枚を次回封印", rarity: "R", penalty: 2, code: "R_6" },

  "SR_1": { name: "ポイントドレイン", desc: "勝つと相手ptを1奪う", rarity: "SR", penalty: 3, code: "SR_1" },
  "SR_2": { name: "見破り", desc: "次回相手のカードが見える", rarity: "SR", penalty: 2, code: "SR_2" },
  "SR_3": { name: "終盤ブースト", desc: "8〜10R勝利で獲得pt+3", rarity: "SR", penalty: 3, code: "SR_3" },
  "SR_4": { name: "吸収カウンター", desc: "負けた時相手が得るptを獲得", rarity: "SR", penalty: 3, code: "SR_4" },
  "SR_5": { name: "道連れ", desc: "負けた時お互いのpt -1", rarity: "SR", penalty: 2, code: "SR_5" },

  "SSR_1": { name: "スワップ", desc: "お互いの数字を入れ替える", rarity: "SSR", penalty: 4, code: "SSR_1" },
  "SSR_2": { name: "ジャイアントキリング", desc: "相手が5以上大きいと無条件勝利", rarity: "SSR", penalty: 3, code: "SSR_2" },
  "SSR_3": { name: "ミラー効果", desc: "前回の相手効果を複製", rarity: "SSR", penalty: 3, code: "SSR_3" },
  "SSR_4": { name: "大逆転", desc: "3pt差以上離れていれば無条件勝利", rarity: "SSR", penalty: 4, code: "SSR_4" }
};

// 初期所持データ（各アイテムに固有IDを付与）
function createDefaultUserData() {
  const inventory = [];
  const deck = {};
  for (let i = 1; i <= 10; i++) {
    const itemId = `def_item_${i}`;
    inventory.push({ id: itemId, code: `DEF_${i}` });
    deck[i] = itemId;
  }
  return { coins: 0, inventory: inventory, deck: deck };
}

let userData = createDefaultUserData();

// 旧構造データの自動マイグレーション
function sanitizeUserData() {
  if (!userData.inventory) {
    userData = createDefaultUserData();
    return;
  }
  if (userData.inventory.length > 0 && typeof userData.inventory[0] === 'string') {
    const newInv = [];
    const newDeck = {};
    const codeToIds = {};

    userData.inventory.forEach((code, idx) => {
      const itemId = `item_migrated_${idx}_${code}`;
      newInv.push({ id: itemId, code: code });
      if (!codeToIds[code]) codeToIds[code] = [];
      codeToIds[code].push(itemId);
    });

    for (let c = 1; c <= 10; c++) {
      const oldCode = userData.deck[c];
      if (oldCode && codeToIds[oldCode] && codeToIds[oldCode].length > 0) {
        newDeck[c] = codeToIds[oldCode].shift();
      } else {
        newDeck[c] = null;
      }
    }
    userData.inventory = newInv;
    userData.deck = newDeck;
  }
}

// --- Firebase Authentication 監視 ---
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  const statusLabel = document.getElementById('userEmailDisplay');
  const authBtn = document.getElementById('authBtn');

  if (user) {
    statusLabel.textContent = user.email;
    authBtn.textContent = "ログアウト";
    await loadUserData(user.uid);
  } else {
    statusLabel.textContent = "未ログイン (ローカル保存)";
    authBtn.textContent = "ログイン";
    loadLocalData();
  }
});

function handleAuthAction() {
  if (currentUser) {
    auth.signOut();
  } else {
    document.getElementById('authModal').style.display = 'flex';
  }
}

function closeAuthModal() {
  document.getElementById('authModal').style.display = 'none';
  document.getElementById('authError').textContent = '';
}

async function registerUser() {
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(cred.user.uid).set(userData);
    closeAuthModal();
  } catch (err) {
    errEl.textContent = "登録エラー: " + err.message;
  }
}

async function loginUser() {
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');

  try {
    await auth.signInWithEmailAndPassword(email, password);
    closeAuthModal();
  } catch (err) {
    errEl.textContent = "ログインエラー: " + err.message;
  }
}

// データ保存・読み込み
async function saveData() {
  document.getElementById('coinCount').textContent = userData.coins;
  if (currentUser) {
    await db.collection('users').doc(currentUser.uid).set(userData);
  } else {
    localStorage.setItem('cards_user_data', JSON.stringify(userData));
  }
}

async function loadUserData(uid) {
  const doc = await db.collection('users').doc(uid).get();
  if (doc.exists) {
    userData = doc.data();
    sanitizeUserData();
  } else {
    userData = createDefaultUserData();
    await db.collection('users').doc(uid).set(userData);
  }
  document.getElementById('coinCount').textContent = userData.coins;
}

function loadLocalData() {
  const local = localStorage.getItem('cards_user_data');
  if (local) {
    userData = JSON.parse(local);
    sanitizeUserData();
  } else {
    userData = createDefaultUserData();
  }
  document.getElementById('coinCount').textContent = userData.coins;
}

// 画面遷移
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  if (screenId === 'deckScreen') renderDeckScreen();
  saveData();
}

// --- ガチャシステム ---
function drawGacha(count) {
  const cost = count === 1 ? 5 : 50;
  if (userData.coins < cost) return alert("コインが足りません！");
  userData.coins -= cost;

  const resultsContainer = document.getElementById('gachaResults');
  resultsContainer.innerHTML = '';
  const gachaPool = Object.keys(EFFECT_MASTER).filter(k => !k.startsWith('DEF'));

  for (let i = 0; i < count; i++) {
    const rand = Math.random() * 100;
    let targetRarity = 'N';
    if (rand > 95) targetRarity = 'SSR';
    else if (rand > 80) targetRarity = 'SR';
    else if (rand > 50) targetRarity = 'R';

    const pool = gachaPool.filter(k => EFFECT_MASTER[k].rarity === targetRarity);
    const pulledCode = pool[Math.floor(Math.random() * pool.length)];

    const newItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      code: pulledCode
    };
    userData.inventory.push(newItem);

    const item = EFFECT_MASTER[pulledCode];
    const cardEl = document.createElement('div');
    cardEl.className = 'gacha-card';
    cardEl.innerHTML = `
      <span class="rarity-badge rarity-${item.rarity}">${item.rarity}</span>
      <div style="font-weight:bold; margin: 4px 0;">${item.name}</div>
      <div style="font-size:10px; color:#94a3b8;">${item.desc}</div>
      <div style="font-size:10px; color:#ef4444;">数字 -${item.penalty}</div>
    `;
    resultsContainer.appendChild(cardEl);
  }
  saveData();
}

// --- デッキ編集 ---
let selectedSlot = null;

function renderDeckScreen() {
  const grid = document.getElementById('deckGrid');
  grid.innerHTML = '';

  for (let cardNum = 1; cardNum <= 10; cardNum++) {
    const itemId = userData.deck[cardNum];
    const invItem = userData.inventory.find(item => item.id === itemId);
    const effectCode = invItem ? invItem.code : null;
    const effect = (effectCode && EFFECT_MASTER[effectCode]) ? EFFECT_MASTER[effectCode] : { name: "なし", desc: "-", penalty: 0, rarity: "DEF" };
    const finalVal = cardNum - effect.penalty;

    const slot = document.createElement('div');
    slot.className = 'deck-slot';
    slot.onclick = () => openEffectModal(cardNum);
    slot.innerHTML = `
      <div class="deck-slot-header">
        <span>ベース ${cardNum}</span>
        <span class="card-val">威力 ${finalVal}</span>
      </div>
      <div class="card-effect-info">
        <span class="rarity-badge rarity-${effect.rarity}">${effect.rarity}</span>
        <strong>${effect.name}</strong>
        <div style="color:#94a3b8;">${effect.desc}</div>
      </div>
    `;
    grid.appendChild(slot);
  }
}

function openEffectModal(cardNum) {
  selectedSlot = cardNum;
  document.getElementById('targetCardNum').textContent = cardNum;
  const list = document.getElementById('inventoryList');
  list.innerHTML = '';

  const emptyItem = document.createElement('div');
  emptyItem.className = 'inventory-item';
  emptyItem.innerHTML = `<span>効果なし (数字ペナルティ 0)</span>`;
  emptyItem.onclick = () => equipEffect(null);
  list.appendChild(emptyItem);

  userData.inventory.forEach((itemObj) => {
    const itemMaster = EFFECT_MASTER[itemObj.code];
    if (!itemMaster) return;

    let equippedOnCard = null;
    for (let c = 1; c <= 10; c++) {
      if (userData.deck[c] === itemObj.id) {
        equippedOnCard = c;
        break;
      }
    }

    let statusBadge = "";
    if (equippedOnCard === cardNum) {
      statusBadge = `<span class="status-badge current">装着中</span>`;
    } else if (equippedOnCard !== null) {
      statusBadge = `<span class="status-badge other">カード${equippedOnCard}に装着中 (付け替え)</span>`;
    }

    const div = document.createElement('div');
    div.className = 'inventory-item';
    div.innerHTML = `
      <div>
        <span class="rarity-badge rarity-${itemMaster.rarity}">${itemMaster.rarity}</span>
        <strong>${itemMaster.name}</strong> (ペナルティ: -${itemMaster.penalty}) ${statusBadge}
        <div style="font-size:10px; color:#94a3b8;">${itemMaster.desc}</div>
      </div>
    `;
    div.onclick = () => equipEffect(itemObj.id);
    list.appendChild(div);
  });

  document.getElementById('effectSelectModal').style.display = 'flex';
}

function equipEffect(itemId) {
  if (itemId) {
    for (let c = 1; c <= 10; c++) {
      if (userData.deck[c] === itemId) {
        userData.deck[c] = null;
      }
    }
  }
  userData.deck[selectedSlot] = itemId;
  closeModal();
  renderDeckScreen();
  saveData();
}

function closeModal() {
  document.getElementById('effectSelectModal').style.display = 'none';
}

// --- 対戦エンジン (CPU / Online) ---
let gameMode = 'cpu';
let peer = null, conn = null;
let pHand = [], cHand = [];
let pScore = 0, cScore = 0;
let currentRound = 1;
let pNextBonus = 0, cNextBonus = 0;
let isForceDrawNext = false;
let myChoice = null, oppChoice = null;

function selectMode(mode) {
  gameMode = mode;
  document.getElementById('btnCpuMode').classList.toggle('active', mode === 'cpu');
  document.getElementById('btnOnlineMode').classList.toggle('active', mode === 'online');
  document.getElementById('onlinePanel').style.display = mode === 'online' ? 'block' : 'none';
  document.getElementById('startBtn').style.display = mode === 'cpu' ? 'block' : 'none';
}

function createRoom() {
  document.getElementById('connectionStatus').textContent = "ID発行中...";
  const roomId = Math.floor(1000 + Math.random() * 9000);
  peer = new Peer(roomId);

  peer.on('open', (id) => {
    const display = document.getElementById('roomIdDisplay');
    display.style.display = 'block'; display.textContent = `ルームID: ${id}`;
    document.getElementById('connectionStatus').textContent = "対戦相手の接続待ち...";
  });

  peer.on('connection', (connection) => {
    conn = connection;
    setupConnection();
  });
}

function joinRoom() {
  const roomId = document.getElementById('joinRoomId').value.trim();
  if (!roomId) return alert("ルームIDを入力してください");
  document.getElementById('connectionStatus').textContent = "接続中...";
  peer = new Peer();
  peer.on('open', () => {
    conn = peer.connect(roomId);
    setupConnection();
  });
}

function setupConnection() {
  conn.on('open', () => {
    document.getElementById('connectionStatus').textContent = "接続完了！";
    setTimeout(startGame, 800);
  });
  conn.on('data', (data) => {
    if (data.type === 'CARD_PLAYED') {
      oppChoice = data.cardData;
      checkRoundResolve();
    }
  });
}

function startGame() {
  showScreen('gameScreen');
  resetGame();
}

function goToStart() {
  if (peer) peer.destroy();
  showScreen('startScreen');
}

function resetGame() {
  pHand = [];
  for (let i = 1; i <= 10; i++) {
    const itemId = userData.deck[i];
    const invItem = userData.inventory.find(item => item.id === itemId);
    const effCode = invItem ? invItem.code : null;
    const eff = (effCode && EFFECT_MASTER[effCode]) ? EFFECT_MASTER[effCode] : { name: "なし", desc: "", penalty: 0, code: "NONE" };
    pHand.push({ baseNum: i, realVal: i - eff.penalty, effect: eff });
  }

  cHand = [];
  for (let i = 1; i <= 10; i++) {
    const effCode = `DEF_${i}`;
    const eff = EFFECT_MASTER[effCode];
    cHand.push({ baseNum: i, realVal: i, effect: eff });
  }

  pScore = 0; cScore = 0; currentRound = 1;
  pNextBonus = 0; cNextBonus = 0; isForceDrawNext = false;
  myChoice = null; oppChoice = null;

  document.getElementById('pScore').textContent = '0';
  document.getElementById('cScore').textContent = '0';
  document.getElementById('turnNum').textContent = '1';
  document.getElementById('pCardSlot').textContent = '-';
  document.getElementById('cCardSlot').textContent = '-';
  document.getElementById('resultMsg').textContent = 'カードを選択してください';

  renderHand();
}

function renderHand() {
  const container = document.getElementById('playerHand');
  container.innerHTML = '';
  pHand.forEach((card, idx) => {
    const btn = document.createElement('button');
    btn.className = 'card-btn';
    btn.innerHTML = `
      <span class="card-num">${card.realVal}</span>
      <span class="card-desc">${card.effect.name}</span>
    `;
    if (myChoice !== null) btn.disabled = true;
    btn.onclick = () => selectCard(idx);
    container.appendChild(btn);
  });
}

function selectCard(handIdx) {
  myChoice = pHand.splice(handIdx, 1)[0];
  renderHand();

  if (gameMode === 'cpu') {
    const cIndex = Math.floor(Math.random() * cHand.length);
    oppChoice = cHand.splice(cIndex, 1)[0];
    resolveRound();
  } else {
    conn.send({ type: 'CARD_PLAYED', cardData: myChoice });
    document.getElementById('resultMsg').textContent = "相手の選択を待っています...";
    checkRoundResolve();
  }
}

function checkRoundResolve() {
  if (myChoice !== null && oppChoice !== null) resolveRound();
}

function resolveRound() {
  let pVal = myChoice.realVal + pNextBonus;
  let cVal = oppChoice.realVal + cNextBonus;
  pNextBonus = 0; cNextBonus = 0;

  if (myChoice.effect.code === "DEF_8") pVal = 12;
  if (oppChoice.effect.code === "DEF_8") cVal = 12;

  let pEffActive = oppChoice.effect.code !== "DEF_7";
  let cEffActive = myChoice.effect.code !== "DEF_7";

  document.getElementById('pCardSlot').textContent = pVal;
  document.getElementById('cCardSlot').textContent = cVal;
  document.getElementById('pEffectDesc').textContent = myChoice.effect.name;
  document.getElementById('cEffectDesc').textContent = oppChoice.effect.name;

  let resultMsg = "";

  if (isForceDrawNext) {
    resultMsg = "強制引き分け！";
    isForceDrawNext = false;
  } else {
    let winner = null;

    if (pVal === cVal) winner = 'DRAW';
    else winner = pVal > cVal ? 'P' : 'C';

    if (myChoice.effect.code === "DEF_1" && oppChoice.baseNum === 10 && pEffActive) winner = 'P';
    if (oppChoice.effect.code === "DEF_1" && myChoice.baseNum === 10 && cEffActive) winner = 'C';

    if (winner === 'P') {
      pScore += 1;
      resultMsg = "あなたの勝ち！";
    } else if (winner === 'C') {
      cScore += 1;
      resultMsg = "相手の勝ち！";
    } else {
      resultMsg = "引き分け！";
    }
  }

  if (myChoice.effect.code === "DEF_5" && pEffActive) pNextBonus = 2;
  if (oppChoice.effect.code === "DEF_5" && cEffActive) cNextBonus = 2;
  if ((myChoice.effect.code === "DEF_9" && pEffActive) || (oppChoice.effect.code === "DEF_9" && cEffActive)) {
    isForceDrawNext = true;
  }

  document.getElementById('resultMsg').textContent = resultMsg;
  document.getElementById('pScore').textContent = pScore;
  document.getElementById('cScore').textContent = cScore;

  myChoice = null; oppChoice = null;

  if (currentRound === 10) {
    setTimeout(() => {
      let isWin = pScore > cScore;
      if (isWin) {
        userData.coins += 2;
        saveData();
      }
      alert(`ゲーム終了！\n${isWin ? "勝利！ (💰 2コイン獲得)" : pScore === cScore ? "引き分け" : "敗北..."}\nスコア: ${pScore} vs ${cScore}`);
      goToStart();
    }, 400);
  } else {
    currentRound++;
    document.getElementById('turnNum').textContent = currentRound;
    renderHand();
  }
}
