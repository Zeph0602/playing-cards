// ゲームの状態管理変数
let pHand = [];
let cHand = [];
let pScore = 0;
let cScore = 0;
let currentRound = 1;
let isGameActive = false;

// 持続効果用フラグ
let pNextBonus = 0;
let cNextBonus = 0;
let isForceDrawNext = false;

// ゲーム初期化・スタート
function startGame() {
  pHand = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  cHand = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  pScore = 0;
  cScore = 0;
  currentRound = 1;
  pNextBonus = 0;
  cNextBonus = 0;
  isForceDrawNext = false;
  isGameActive = true;

  // UIリセット
  document.getElementById('turnNum').textContent = currentRound;
  document.getElementById('pScore').textContent = pScore;
  document.getElementById('cScore').textContent = cScore;
  document.getElementById('pCardSlot').textContent = '-';
  document.getElementById('cCardSlot').textContent = '-';
  document.getElementById('pEffectDesc').textContent = '';
  document.getElementById('cEffectDesc').textContent = '';
  document.getElementById('resultMsg').textContent = 'カードを選択してください';
  document.getElementById('startBtn').textContent = 'ゲームをリセット';

  renderHand();
}

function renderHand() {
  const container = document.getElementById('playerHand');
  container.innerHTML = '';
  const fullHand = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  fullHand.forEach(num => {
    const btn = document.createElement('button');
    btn.className = 'card-btn';
    btn.textContent = num;
    // 使用済みカードまたはゲーム未開始時はボタンを無効化
    if (!isGameActive || !pHand.includes(num)) {
      btn.disabled = true;
    } else {
      btn.onclick = () => playRound(num);
    }
    container.appendChild(btn);
  });
}

function playRound(pChoice) {
  if (!isGameActive || currentRound > 10) return;

  // CPUの手札選択
  const cIndex = Math.floor(Math.random() * cHand.length);
  const cChoice = cHand.splice(cIndex, 1)[0];

  // プレイヤーの手札から除外
  pHand = pHand.filter(n => n !== pChoice);

  // 数値計算
  let pBase = pChoice;
  let cBase = cChoice;
  let pReal = pBase + pNextBonus;
  let cReal = cBase + cNextBonus;

  const pAppliedBonus = pNextBonus;
  const cAppliedBonus = cNextBonus;
  pNextBonus = 0;
  cNextBonus = 0;

  if (pBase === 8) pReal = 12 + pAppliedBonus;
  if (cBase === 8) cReal = 12 + cAppliedBonus;

  // 7の無効化判定
  let pEffectActive = (cBase !== 7);
  let cEffectActive = (pBase !== 7);

  // 表示更新
  document.getElementById('pCardSlot').textContent = pReal;
  document.getElementById('cCardSlot').textContent = cReal;

  let pDesc = pBase === 8 ? '【8】基本12' : `【${pBase}】`;
  let cDesc = cBase === 8 ? '【8】基本12' : `【${cBase}】`;
  if (pAppliedBonus > 0) pDesc += ' (+2補正)';
  if (cAppliedBonus > 0) cDesc += ' (+2補正)';
  document.getElementById('pEffectDesc').textContent = pDesc;
  document.getElementById('cEffectDesc').textContent = cDesc;

  let resultMsg = "";

  // 9の強制引き分け判定
  if (isForceDrawNext) {
    resultMsg = "前回の9効果により【強制引き分け】！";
    isForceDrawNext = false;
  } else {
    let winner = null;

    // 2と10の判定
    let isSmallWins = false;
    if ((pBase === 2 && pEffectActive) || (cBase === 2 && cEffectActive)) {
      isSmallWins = true;
      if ((pBase === 10 && pEffectActive) || (cBase === 10 && cEffectActive)) {
        isSmallWins = false;
      }
    }

    // 1（対10）の判定
    let pOneSpecial = (pBase === 1 && pEffectActive && cBase === 10 && cEffectActive);
    let cOneSpecial = (cBase === 1 && cEffectActive && pBase === 10 && pEffectActive);

    if (pOneSpecial && !cOneSpecial) {
      winner = 'P';
      resultMsg = "1の効果発動！10に勝利！";
    } else if (cOneSpecial && !pOneSpecial) {
      winner = 'C';
      resultMsg = "CPUの1の効果発動！10に勝利！";
    } else {
      if (pReal === cReal) {
        winner = 'DRAW';
        resultMsg = "引き分け！";
      } else if (isSmallWins) {
        winner = pReal < cReal ? 'P' : 'C';
        resultMsg = `2の効果（小勝ち）：${winner === 'P' ? 'あなたの勝ち！' : 'CPUの勝ち…'}`;
      } else {
        winner = pReal > cReal ? 'P' : 'C';
        resultMsg = `${winner === 'P' ? 'あなたの勝ち！' : 'CPUの勝ち…'}`;
      }
    }

    // スコア処理
    if (winner === 'P') {
      let addPt = (pBase === 6 && pEffectActive) ? 2 : 1;
      if (cBase === 3 && cEffectActive) {
        addPt = 0;
        resultMsg += " (CPUの3効果でptなし)";
      }
      pScore += addPt;

      if (pBase === 4 && pEffectActive) {
        cScore -= 1;
        resultMsg += " (4効果でCPU pt-1)";
      }
    } else if (winner === 'C') {
      let addPt = (cBase === 6 && cEffectActive) ? 2 : 1;
      if (pBase === 3 && pEffectActive) {
        addPt = 0;
        resultMsg += " (あなたの3効果でCPU ptなし)";
      }
      cScore += addPt;

      if (cBase === 4 && cEffectActive) {
        pScore -= 1;
        resultMsg += " (CPUの4効果でpt-1)";
      }
    }
  }

  // 持続効果セット
  if (pBase === 5 && pEffectActive) pNextBonus = 2;
  if (cBase === 5 && cEffectActive) cNextBonus = 2;
  if ((pBase === 9 && pEffectActive) || (cBase === 9 && cEffectActive)) {
    isForceDrawNext = true;
  }

  // 状態反映
  document.getElementById('resultMsg').textContent = resultMsg;
  document.getElementById('pScore').textContent = pScore;
  document.getElementById('cScore').textContent = cScore;

  renderHand();

  // ターン終了処理
  if (currentRound === 10) {
    isGameActive = false;
    renderHand();
    setTimeout(() => {
      let finalMsg = pScore > cScore ? `【ゲーム終了】あなたの勝利です！ (${pScore} vs ${cScore})`
                   : pScore < cScore ? `【ゲーム終了】CPUの勝利です… (${pScore} vs ${cScore})`
                   : `【ゲーム終了】引き分けです！ (${pScore} vs ${cScore})`;
      alert(finalMsg);
    }, 200);
  } else {
    currentRound++;
    document.getElementById('turnNum').textContent = currentRound;
  }
}

// モーダル制御
function openRuleModal() {
  document.getElementById('ruleModal').style.display = 'flex';
}

function closeRuleModal() {
  document.getElementById('ruleModal').style.display = 'none';
}

// モーダル外枠クリックで閉じる
window.onclick = function(event) {
  const modal = document.getElementById('ruleModal');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
};

// 初期表示（待機状態）
renderHand();
