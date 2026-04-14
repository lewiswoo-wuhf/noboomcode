const STORAGE_KEY = 'noboomcode_user';
const MATCH_SESSION_KEY = 'noboomcode_match';
const MATCH_TARGET = 5;
const MATCH_TIMEOUT_MS = 30000;
const COUNTDOWN_SECONDS = 3;

function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('读取用户信息失败', error);
    return null;
  }
}

function saveUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderUserBadge(user) {
  const panel = document.getElementById('userPanel');
  if (!panel) return;

  if (!user) {
    panel.innerHTML = '<div class="user-badge"><span>未登录</span></div>';
    return;
  }

  const avatarUrl = user.avatar || 'https://api.dicebear.com/5.x/thumbs/svg?seed=' + encodeURIComponent(user.name);
  panel.innerHTML = `
    <div class="user-badge">
      <img class="user-avatar" src="${avatarUrl}" alt="用户头像" />
      <div>
        <div class="user-name">${escapeHtml(user.name)}</div>
      </div>
    </div>
  `;
}

function openLoginModal() {
  const modal = document.getElementById('loginModal');
  if (!modal) return;
  modal.classList.remove('hidden');
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function getStoredMatch() {
  try {
    const raw = sessionStorage.getItem(MATCH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function saveMatch(players) {
  sessionStorage.setItem(MATCH_SESSION_KEY, JSON.stringify(players));
}

function clearMatch() {
  sessionStorage.removeItem(MATCH_SESSION_KEY);
}

function randomOtherPlayer(seed) {
  const names = ['小虎', '大白', '夏天', '飞羽', '星落', '米粒', '阿喵', '小南', '风铃', '暖阳'];
  const name = names[seed % names.length] + Math.floor(Math.random() * 80 + 10);
  return {
    name,
    avatar: `https://api.dicebear.com/5.x/thumbs/svg?seed=${encodeURIComponent(name)}`
  };
}

function buildMatchPlayer(user) {
  return {
    name: user.name,
    avatar: user.avatar || `https://api.dicebear.com/5.x/thumbs/svg?seed=${encodeURIComponent(user.name)}`,
    self: true
  };
}

function renderMatchSlots(players) {
  const list = document.getElementById('matchList');
  if (!list) return;

  const items = [];
  for (let index = 0; index < MATCH_TARGET; index++) {
    const player = players[index];
    if (player) {
      items.push(`
        <div class="player-card ${player.self ? 'player-self' : ''}">
          <img class="player-avatar" src="${escapeHtml(player.avatar)}" alt="${escapeHtml(player.name)} 的头像" />
          <div class="player-info">
            <strong>${escapeHtml(player.name)}</strong>
            <span>${player.self ? '你自己' : '已加入'}</span>
          </div>
        </div>
      `);
    } else {
      items.push(`
        <div class="player-card placeholder">
          <div class="player-avatar placeholder-circle"></div>
          <div class="player-info">
            <strong>等待中</strong>
            <span>正在匹配</span>
          </div>
        </div>
      `);
    }
  }

  list.innerHTML = items.join('');
}

function setMatchMessage(text) {
  const label = document.getElementById('matchMessage');
  if (label) label.textContent = text;
}

function setProgress(value) {
  const bar = document.getElementById('matchProgress');
  if (!bar) return;
  bar.style.width = `${Math.min(100, Math.max(0, value))}%`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function simulateBackendMatch(user, signal) {
  return new Promise((resolve, reject) => {
    const delay = 1200 + Math.random() * 1800;
    const timer = setTimeout(() => {
      const players = [buildMatchPlayer(user)];
      for (let i = 0; i < MATCH_TARGET - 1; i += 1) {
        players.push(randomOtherPlayer(i + 3));
      }
      resolve(players);
    }, delay);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('请求已取消', 'AbortError'));
      }, { once: true });
    }
  });
}

async function revealPlayers(players) {
  for (let index = 1; index <= players.length; index += 1) {
    renderMatchSlots(players.slice(0, index));
    setMatchMessage(`已匹配 ${index}/${MATCH_TARGET} 名玩家`);
    setProgress(20 + ((index / MATCH_TARGET) * 60));
    await sleep(300);
  }
}

function showMatchResultButtons(showRetry) {
  const retryButton = document.getElementById('retryButton');
  if (!retryButton) return;
  retryButton.classList.toggle('hidden', !showRetry);
}

function resetMatchControls() {
  const cancelButton = document.getElementById('cancelButton');
  if (cancelButton) {
    cancelButton.disabled = false;
  }
  showMatchResultButtons(false);
}

function disableMatchControls() {
  // 保留函数占位，当前匹配过程中“取消”按钮应保持可用。
}

async function startMatch(user) {
  const cancelButton = document.getElementById('cancelButton');
  const retryButton = document.getElementById('retryButton');

  if (!cancelButton || !retryButton) return;

  const controller = new AbortController();
  const signal = controller.signal;

  renderMatchSlots([]);
  setProgress(5);
  setMatchMessage('正在请求匹配服务，请稍候...');

  let progress = 0;
  const progressTimer = setInterval(() => {
    progress = Math.min(90, progress + Math.random() * 8 + 3);
    setProgress(progress);
  }, 650);

  const timeoutTimer = setTimeout(() => {
    controller.abort();
  }, MATCH_TIMEOUT_MS);

  cancelButton.onclick = () => {
    controller.abort();
  };

  retryButton.onclick = async () => {
    showMatchResultButtons(false);
    setProgress(5);
    await startMatch(user);
  };

  try {
    const players = await simulateBackendMatch(user, signal);
    clearInterval(progressTimer);
    clearTimeout(timeoutTimer);
    setProgress(100);
    await revealPlayers(players);
    saveMatch(players);
    setMatchMessage('匹配成功，准备进入倒计时页面...');
    await sleep(500);
    window.location.href = 'countdown.html';
  } catch (error) {
    clearInterval(progressTimer);
    clearTimeout(timeoutTimer);
    if (error.name === 'AbortError') {
      setMatchMessage('匹配已取消。');
      renderMatchSlots([]);
      setProgress(0);
      showMatchResultButtons(true);
    } else {
      setMatchMessage('匹配失败，请稍后重试。');
      renderMatchSlots([]);
      setProgress(0);
      showMatchResultButtons(true);
    }
  } finally {
    resetMatchControls();
  }
}

function initHome() {
  const user = getStoredUser();
  renderUserBadge(user);

  const matchButton = document.getElementById('matchButton');
  const closeModalButton = document.getElementById('closeModalButton');
  const loginForm = document.getElementById('loginForm');
  const nicknameInput = document.getElementById('nicknameInput');
  const avatarInput = document.getElementById('avatarInput');

  let pending = false;

  if (!matchButton) return;

  matchButton.addEventListener('click', () => {
    if (pending) return;
    pending = true;
    matchButton.disabled = true;
    setTimeout(() => {
      pending = false;
      matchButton.disabled = false;
    }, 700);

    if (!getStoredUser()) {
      openLoginModal();
      return;
    }

    window.location.href = 'match.html';
  });

  if (closeModalButton) {
    closeModalButton.addEventListener('click', () => closeLoginModal());
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeLoginModal();
    }
  });

  if (loginForm) {
    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const nickname = nicknameInput.value.trim();
      const avatar = avatarInput.value.trim();
      if (!nickname) return;
      saveUser({ name: nickname, avatar: avatar || '' });
      renderUserBadge({ name: nickname, avatar });
      closeLoginModal();
      window.location.href = 'match.html';
    });
  }
}

function initMatch() {
  const user = getStoredUser();
  renderUserBadge(user);

  if (!user) {
    setMatchMessage('未检测到登录信息，请先返回首页登录。');
    renderMatchSlots([]);
    disableMatchControls();
    showMatchResultButtons(true);
    return;
  }

  startMatch(user);
}

function renderCountdownPlayers(players) {
  const list = document.getElementById('countdownList');
  if (!list) return;

  list.innerHTML = players.map((player) => `
    <div class="player-card ${player.self ? 'player-self' : ''}">
      <img class="player-avatar" src="${escapeHtml(player.avatar)}" alt="${escapeHtml(player.name)} 的头像" />
      <div class="player-info">
        <strong>${escapeHtml(player.name)}</strong>
        <span>${player.self ? '你自己' : '已进入'}</span>
      </div>
    </div>
  `).join('');
}

function initCountdown() {
  const user = getStoredUser();
  renderUserBadge(user);

  const players = getStoredMatch();
  if (!players || players.length < MATCH_TARGET) {
    window.location.href = 'index.html';
    return;
  }

  renderCountdownPlayers(players);

  const countdownValue = document.getElementById('countdownValue');
  if (!countdownValue) return;

  let seconds = COUNTDOWN_SECONDS;
  countdownValue.textContent = String(seconds);

  const timer = setInterval(() => {
    seconds -= 1;
    if (seconds <= 0) {
      clearInterval(timer);
      window.location.href = 'game.html';
      return;
    }
    countdownValue.textContent = String(seconds);
  }, 1000);
}

function renderRoomPlayers(players) {
  const list = document.getElementById('roomList');
  if (!list) return;
  list.innerHTML = players.map((player) => `
    <div class="player-card ${player.self ? 'player-self' : ''}">
      <img class="player-avatar" src="${escapeHtml(player.avatar)}" alt="${escapeHtml(player.name)} 的头像" />
      <div class="player-info">
        <strong>${escapeHtml(player.name)}</strong>
        <span>${player.self ? '你自己' : '对手'}</span>
      </div>
    </div>
  `).join('');
}

// ========== Game Room Functions ==========

function calculatePlayerPositions(count, radiusX, radiusY, centerX, centerY) {
  const positions = [];
  const angleStep = (2 * Math.PI) / count;
  
  for (let i = 0; i < count; i++) {
    // 从顶部开始（-PI/2），顺时针排列
    const angle = -Math.PI / 2 + i * angleStep;
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    positions.push({ x, y, index: i });
  }
  
  return positions;
}

function renderGameTable(players) {
  const circle = document.getElementById('playersCircle');
  if (!circle) return;
  
  const table = document.querySelector('.game-table');
  const tableRect = table.getBoundingClientRect();
  const centerX = tableRect.width / 2;
  const centerY = tableRect.height / 2;
  
  // 根据表格大小计算半径
  const radiusX = tableRect.width * 0.38;
  const radiusY = tableRect.height * 0.38;
  
  const positions = calculatePlayerPositions(players.length, radiusX, radiusY, centerX, centerY);
  
  circle.innerHTML = players.map((player, index) => {
    const pos = positions[index];
    return `
      <div class="player-position ${player.self ? 'player-self' : ''}" 
           data-index="${index}"
           style="left: ${pos.x}px; top: ${pos.y}px; transform: translate(-50%, -50%);">
        <div class="player-avatar-wrapper">
          <img class="player-avatar" src="${escapeHtml(player.avatar)}" alt="${escapeHtml(player.name)} 的头像" />
        </div>
        <div class="player-name-tag">${escapeHtml(player.name)}</div>
      </div>
    `;
  }).join('');
}

function updateTurnIndicator(currentPlayerIndex, players) {
  const indicator = document.getElementById('turnIndicator');
  if (!indicator) return;
  
  const table = document.querySelector('.game-table');
  const tableRect = table.getBoundingClientRect();
  const centerX = tableRect.width / 2;
  const centerY = tableRect.height / 2;
  const radiusX = tableRect.width * 0.38;
  const radiusY = tableRect.height * 0.38;
  
  // 计算当前玩家位置
  const angleStep = (2 * Math.PI) / players.length;
  const angle = -Math.PI / 2 + currentPlayerIndex * angleStep;
  const x = centerX + radiusX * Math.cos(angle);
  const y = centerY + radiusY * Math.sin(angle);
  
  // 将指示器放在玩家上方
  indicator.style.left = `${x}px`;
  indicator.style.top = `${y - 60}px`;
  indicator.style.transform = 'translate(-50%, -50%)';
  
  // 移除所有玩家的 current-turn 类
  document.querySelectorAll('.player-position').forEach(el => {
    el.classList.remove('current-turn');
  });
  
  // 给当前玩家添加 current-turn 类
  const currentPlayerEl = document.querySelector(`.player-position[data-index="${currentPlayerIndex}"]`);
  if (currentPlayerEl) {
    currentPlayerEl.classList.add('current-turn');
  }
}

function startTurnRotation(players) {
  let currentIndex = 0;
  
  // 初始显示
  updateTurnIndicator(currentIndex, players);
  
  // 每3秒轮换一次
  setInterval(() => {
    currentIndex = (currentIndex + 1) % players.length;
    updateTurnIndicator(currentIndex, players);
  }, 3000);
}

function initHandArea() {
  const handCards = document.getElementById('handCards');
  const cardCount = document.getElementById('cardCount');
  const drawCardBtn = document.getElementById('drawCardBtn');
  
  if (!handCards || !cardCount || !drawCardBtn) return;
  
  // 模拟手牌数据
  const myCards = ['🂡', '🂱', '🃁', '🃑'];
  handCards.innerHTML = myCards.map(card => 
    `<div class="hand-card">${card}</div>`
  ).join('');
  
  cardCount.textContent = '4';
  drawCardBtn.disabled = false;
  
  // 抽卡按钮事件
  drawCardBtn.addEventListener('click', () => {
    const newCard = ['🂢', '🂲', '🃂', '🃒'][Math.floor(Math.random() * 4)];
    const cardDiv = document.createElement('div');
    cardDiv.className = 'hand-card';
    cardDiv.textContent = newCard;
    handCards.appendChild(cardDiv);
    cardCount.textContent = String(handCards.children.length);
  });
}

function initLeaveRoom() {
  const leaveBtn = document.getElementById('leaveRoomBtn');
  if (!leaveBtn) return;
  
  leaveBtn.addEventListener('click', () => {
    if (confirm('确定要离开房间吗？')) {
      clearMatch();
      window.location.href = 'index.html';
    }
  });
}

function initGame() {
  const user = getStoredUser();
  renderUserBadge(user);

  const players = getStoredMatch();
  if (!players || players.length < MATCH_TARGET) {
    window.location.href = 'index.html';
    return;
  }

  // 渲染游戏桌和玩家环形布局
  renderGameTable(players);
  
  // 初始化手牌区域
  initHandArea();
  
  // 初始化离开房间按钮
  initLeaveRoom();
  
  // 启动回合轮换动画
  startTurnRotation(players);
}

function initPage() {
  const pageType = document.body.dataset.page;
  if (pageType === 'home') {
    initHome();
  }
  if (pageType === 'match') {
    initMatch();
  }
  if (pageType === 'countdown') {
    initCountdown();
  }
  if (pageType === 'game') {
    initGame();
  }
}

document.addEventListener('DOMContentLoaded', initPage);
