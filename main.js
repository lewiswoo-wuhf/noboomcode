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

function randomOtherPlayer(seed, isBot = false) {
  const names = ['小虎', '大白', '夏天', '飞羽', '星落', '米粒', '阿喵', '小南', '风铃', '暖阳'];
  const name = names[seed % names.length] + Math.floor(Math.random() * 80 + 10);
  return {
    name,
    avatar: `https://api.dicebear.com/5.x/thumbs/svg?seed=${encodeURIComponent(name)}`,
    isBot: isBot // 标记是否为 Bot
  };
}

function buildMatchPlayer(user) {
  return {
    name: user.name,
    avatar: user.avatar || `https://api.dicebear.com/5.x/thumbs/svg?seed=${encodeURIComponent(user.name)}`,
    self: true,
    isBot: false
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
        // 匹配环节直接生成 Bot (Issue #17)
        players.push(randomOtherPlayer(i + 3, true));
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

// ========== Game State Management (Issue #7) ==========

// 托管状态管理（Issues #13, #14, #15）
let isAutoPlay = false; // 是否处于托管状态
let turnTimer = null; // 回合倒计时定时器
const TURN_DURATION = 5; // 每回合5秒（Issue #13：调整为5秒）
let pendingManualResume = false; // 标记是否需要在下一轮恢复手动操作（Issue #15）

// 8种牌型定义（Issue #8）
const CARD_TYPES = {
  BOMB: { id: 'bomb', name: '炸弹', icon: '💣', color: 'bomb' },
  SHOVEL: { id: 'shovel', name: '洛阳铲', icon: '⛏️', color: 'shovel' },
  CLEAR_SIGHT: { id: 'clear-sight', name: '明察秋毫', icon: '👁️', color: 'clear-sight' },
  STEAL: { id: 'steal', name: '顺手牵羊', icon: '🐑', color: 'steal' },
  COUNTER_ATTACK: { id: 'counter-attack', name: '回马枪', icon: '🔫', color: 'counter-attack' },
  RECOVER: { id: 'recover', name: '休养生息', icon: '🏥', color: 'recover' },
  SWAP: { id: 'swap', name: '偷梁换柱', icon: '🔄', color: 'swap' },
  FRAME: { id: 'frame', name: '栽赃嫁祸', icon: '🎭', color: 'frame' }
};

// 底牌堆管理（Issue #8）
let deckCount = 28; // 初始28张底牌

function initDeckPile() {
  const deckStack = document.getElementById('deckStack');
  const deckNumber = document.querySelector('.deck-number');
  
  if (!deckStack || !deckNumber) return;
  
  // 从localStorage恢复底牌数量（断线/刷新恢复）
  const storedDeckCount = localStorage.getItem('deckCount');
  if (storedDeckCount !== null) {
    deckCount = parseInt(storedDeckCount);
  }
  
  // 渲染卡牌堆叠效果（最多显示5张，实际数量由deckCount决定）
  renderDeckStack(deckStack);
  
  // 更新数量显示
  deckNumber.textContent = deckCount;
  
  console.log(`🎴 底牌堆已初始化，剩余 ${deckCount} 张`);
}

function renderDeckStack(deckStack) {
  // 清空现有卡牌
  deckStack.innerHTML = '';
  
  // 最多显示5张卡牌的堆叠效果
  const cardsToShow = Math.min(deckCount, 5);
  
  for (let i = 0; i < cardsToShow; i++) {
    const card = document.createElement('div');
    card.className = 'deck-card';
    deckStack.appendChild(card);
  }
}

function updateDeckCount(newCount) {
  const deckNumber = document.querySelector('.deck-number');
  const deckStack = document.getElementById('deckStack');
  const deckCountEl = document.getElementById('deckCount');
  const deckPlaceholder = document.getElementById('deckPlaceholder');
  
  if (!deckNumber || !deckStack) return;
  
  deckCount = newCount;
  deckNumber.textContent = deckCount;
  renderDeckStack(deckStack);
  
  // 当牌抓完时，隐藏牌堆和计数，显示"底牌区"文本
  if (deckCount <= 0) {
    if (deckStack) deckStack.style.display = 'none';
    if (deckCountEl) deckCountEl.style.display = 'none';
    if (deckPlaceholder) deckPlaceholder.style.display = 'flex';
  } else {
    if (deckStack) deckStack.style.display = 'flex';
    if (deckCountEl) deckCountEl.style.display = 'flex';
    if (deckPlaceholder) deckPlaceholder.style.display = 'none';
  }
  
  // 保存到 localStorage
  localStorage.setItem('deckCount', deckCount);
}

// 更新底牌显示（简化版，用于 Bot 操作）
function updateDeckDisplay() {
  const deckNumber = document.querySelector('.deck-number');
  const deckStack = document.getElementById('deckStack');
  
  if (!deckNumber || !deckStack) return;
  
  deckNumber.textContent = deckCount;
  renderDeckStack(deckStack);
  localStorage.setItem('deckCount', deckCount);
}

// 模拟抽牌动作
function drawCardFromDeck() {
  const deckStack = document.getElementById('deckStack');
  const deckNumber = document.querySelector('.deck-number');
  
  if (!deckStack || deckCount <= 0) {
    console.log('⚠️ 牌堆已空，无法抽牌');
    return null;
  }
  
  // 创建抽牌动画
  const topCard = deckStack.lastElementChild;
  if (topCard && topCard.classList.contains('deck-card')) {
    topCard.classList.add('drawing');
    
    // 动画结束后更新牌堆
    setTimeout(() => {
      updateDeckCount(deckCount - 1);
    }, 600);
  }
  
  // 随机返回一张牌型（模拟）
  const cardTypeKeys = Object.keys(CARD_TYPES);
  const randomKey = cardTypeKeys[Math.floor(Math.random() * cardTypeKeys.length)];
  const drawnCard = CARD_TYPES[randomKey];
  
  console.log(`🎴 抽到卡牌: ${drawnCard.name} ${drawnCard.icon}`);
  return drawnCard;
}

// 渲染8种牌型展示
function renderCardTypes() {
  const cardTypeDisplay = document.getElementById('cardTypeDisplay');
  if (!cardTypeDisplay) return;
  
  // 清空现有内容
  cardTypeDisplay.innerHTML = '';
  
  // 渲染所有牌型图标
  Object.values(CARD_TYPES).forEach(cardType => {
    const icon = document.createElement('div');
    icon.className = `card-type-icon ${cardType.color}`;
    icon.textContent = cardType.icon;
    icon.title = cardType.name;
    
    // 点击显示牌型名称
    icon.addEventListener('click', () => {
      console.log(` 牌型: ${cardType.name}`);
      showCardTypeInfo(cardType);
    });
    
    cardTypeDisplay.appendChild(icon);
  });
  
  console.log('🃏 8种牌型展示已渲染');
}

// 显示牌型信息
function showCardTypeInfo(cardType) {
  const tableMessage = document.querySelector('.table-message');
  if (tableMessage) {
    tableMessage.textContent = `${cardType.icon} ${cardType.name}`;
    
    // 3秒后恢复默认消息
    setTimeout(() => {
      tableMessage.textContent = '游戏进行中...';
    }, 3000);
  }
}

function initGameStateManagement() {
  // 初始化游戏状态
  const gameProgress = document.getElementById('gameProgress');
  const currentTurn = document.getElementById('currentTurn');
  
  if (gameProgress) {
    gameProgress.textContent = '准备中';
  }
  
  // 模拟游戏状态变化（仅用于演示）
  setTimeout(() => {
    if (gameProgress) gameProgress.textContent = '进行中';
    simulatePlayerEvents();
  }, 3000);
  
  // 监听页面可见性变化（处理刷新恢复）
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // 监听网络状态变化
  window.addEventListener('online', handleOnlineStatus);
  window.addEventListener('offline', handleOfflineStatus);
  
  console.log('🎮 游戏状态管理已初始化');
}

function updateGameProgress(status) {
  const gameProgress = document.getElementById('gameProgress');
  if (gameProgress) {
    gameProgress.textContent = status;
  }
}

function updateCurrentTurn(playerName) {
  const currentTurn = document.getElementById('currentTurn');
  if (currentTurn) {
    currentTurn.textContent = playerName || '-';
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    console.log('📱 页面已隐藏，暂停游戏动画');
    // 暂停倒计时定时器
    if (turnTimer) {
      clearInterval(turnTimer);
    }
  } else {
    console.log('👁️ 页面已显示，恢复游戏状态');
    // 刷新页面状态并重启倒计时
    restoreGameState();
    
    // 如果当前有回合在进行，重启倒计时
    const currentTurnEl = document.getElementById('currentTurn');
    if (currentTurnEl && currentTurnEl.textContent !== '-') {
      resetTurnCountdown();
    }
  }
}

function handleOnlineStatus() {
  console.log('🌐 网络已连接');
  // 恢复在线状态
  if (window.currentPlayers) {
    const selfPlayer = window.currentPlayers.find(p => p.self);
    if (selfPlayer) {
      selfPlayer.online = true;
      renderGameTable(window.currentPlayers);
    }
  }
}

function handleOfflineStatus() {
  console.log('⚠️ 网络已断开');
  updateGameProgress('网络异常');
}

function restoreGameState() {
  // 从localStorage恢复游戏状态
  const match = getStoredMatch();
  if (match && match.length >= MATCH_TARGET) {
    console.log('✅ 游戏状态已恢复');
    updateGameProgress('恢复中');
    setTimeout(() => {
      updateGameProgress('进行中');
    }, 1000);
  }
}

function simulatePlayerEvents() {
  // 模拟玩家进出事件（仅用于演示）
  console.log('🎭 开始模拟玩家事件');
  
  // 5秒后模拟一个玩家离开
  setTimeout(() => {
    if (window.currentPlayers && window.currentPlayers.length > 1) {
      const randomIndex = Math.floor(Math.random() * (window.currentPlayers.length - 1)) + 1;
      const player = window.currentPlayers[randomIndex];
      if (player && !player.self) {
        player.online = false;
        renderGameTable(window.currentPlayers);
        console.log(`👋 ${player.name} 已断开连接`);
        updateGameProgress('等待重连');
        
        // 3秒后模拟玩家重连
        setTimeout(() => {
          player.online = true;
          renderGameTable(window.currentPlayers);
          console.log(`👋 ${player.name} 已重新连接`);
          updateGameProgress('进行中');
        }, 3000);
      }
    }
  }, 5000);
}

// ========== Game Room Functions ==========

function calculatePlayerPositions(count, radiusX, radiusY, centerX, centerY) {
  const positions = [];
  const angleStep = (2 * Math.PI) / count;
  
  for (let i = 0; i < count; i++) {
    // 从底部开始（PI/2），逆时针排列，这样自己在底部
    const angle = Math.PI / 2 + i * angleStep;
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    positions.push({ x, y, index: i });
  }
  
  return positions;
}

function renderGameTable(players) {
  const circle = document.getElementById('playersCircle');
  if (!circle) return;
  
  const gameArea = document.querySelector('.game-area');
  const areaRect = gameArea.getBoundingClientRect();
  const centerX = areaRect.width / 2;
  const centerY = areaRect.height / 2;
  
  // 玩家头像放在牌桌外围，使用更大的半径
  const radiusX = areaRect.width * 0.42;
  const radiusY = areaRect.height * 0.42;
  
  // 重新排列玩家顺序，让自己在第一个位置（底部）
  const selfIndex = players.findIndex(p => p.self);
  const reorderedPlayers = [
    players[selfIndex],
    ...players.slice(0, selfIndex),
    ...players.slice(selfIndex + 1)
  ];
  
  const positions = calculatePlayerPositions(reorderedPlayers.length, radiusX, radiusY, centerX, centerY);
  
  // 为每个玩家生成手牌数量（初始都是5张）
  const handCounts = reorderedPlayers.map((player, index) => {
    return 5; // 所有玩家初始5张牌
  });
  
  circle.innerHTML = reorderedPlayers.map((player, index) => {
    const pos = positions[index];
    const cardCount = handCounts[index];
    
    return `
      <div class="player-position ${player.self ? 'player-self' : ''}" 
           data-index="${index}"
           style="left: ${pos.x}px; top: ${pos.y}px; transform: translate(-50%, -50%);">
        <div class="player-avatar-wrapper">
          <img class="player-avatar" src="${escapeHtml(player.avatar)}" alt="${escapeHtml(player.name)} 的头像" />
          ${!player.self ? `<div class="hand-count-badge">${cardCount}</div>` : ''}
          <div class="online-status ${player.online ? 'online' : 'offline'}"></div>
          <div class="auto-play-label-mini hidden" id="autoPlayLabel-${index}">托管中</div>
          ${player.isBot ? '<div class="bot-tag">Bot</div>' : ''}
        </div>
        <div class="player-name-tag">${escapeHtml(player.name)}</div>
        ${!player.online ? '<div class="offline-tag">离线</div>' : ''}
      </div>
    `;
  }).join('');
  
  // 保存手牌数量和重新排序后的玩家列表到全局变量
  window.playerHandCounts = handCounts;
  window.currentPlayers = reorderedPlayers;
  
  // 更新在线人数
  const onlineCount = reorderedPlayers.filter(p => p.online).length;
  const totalPlayers = reorderedPlayers.length;
  const onlineCountEl = document.getElementById('onlineCount');
  if (onlineCountEl) {
    onlineCountEl.textContent = `${onlineCount}/${totalPlayers}`;
  }
}

function updateTurnIndicator(currentPlayerIndex, players) {
  const indicator = document.getElementById('turnIndicator');
  if (!indicator) return;
  
  const gameArea = document.querySelector('.game-area');
  const areaRect = gameArea.getBoundingClientRect();
  const centerX = areaRect.width / 2;
  const centerY = areaRect.height / 2;
  const radiusX = areaRect.width * 0.42;
  const radiusY = areaRect.height * 0.42;
  
  // 计算当前玩家位置
  const angleStep = (2 * Math.PI) / players.length;
  const angle = Math.PI / 2 + currentPlayerIndex * angleStep;
  const x = centerX + radiusX * Math.cos(angle);
  const y = centerY + radiusY * Math.sin(angle);
  
  // 移动指示器
  indicator.style.left = `${x}px`;
  indicator.style.top = `${y}px`;
  
  // 更新状态栏显示
  const currentTurnEl = document.getElementById('currentTurn');
  if (currentTurnEl && players[currentPlayerIndex]) {
    currentTurnEl.textContent = players[currentPlayerIndex].name;
  }
  
  // 重置并启动倒计时（Issue #13）
  resetTurnCountdown();
  
  // 检查是否需要从托管切换回手动（Issue #15）
  checkManualResume();
  
  // 更新按钮可用状态（Issue #9 & #10）
  const drawCardBtn = document.getElementById('drawCardBtn');
  const playCardBtn = document.getElementById('playCardBtn');
  const handCards = document.getElementById('handCards');
  
  const isMyTurn = players[currentPlayerIndex] && players[currentPlayerIndex].self;
  
  // 只有是自己的回合才启用按钮，防止其他玩家（包括 Bot）回合时真人玩家误触
  const shouldEnable = isMyTurn;
  
  if (drawCardBtn) {
    drawCardBtn.disabled = !shouldEnable || deckCount <= 0; // 没牌了也禁用
  }
  
  if (playCardBtn) {
    playCardBtn.disabled = !shouldEnable || (handCards && handCards.children.length === 0); // 没手牌也禁用
  }
}

// 重置回合倒计时（Issue #13）
function resetTurnCountdown() {
  clearInterval(turnTimer);
  let seconds = TURN_DURATION;
  const countdownEl = document.getElementById('turnCountdown');
  if (countdownEl) {
    countdownEl.textContent = seconds;
    countdownEl.classList.remove('warning');
  }
  
  turnTimer = setInterval(() => {
    seconds--;
    if (countdownEl) {
      countdownEl.textContent = seconds;
      if (seconds <= 5) {
        countdownEl.classList.add('warning');
      } else {
        countdownEl.classList.remove('warning');
      }
    }
    
    if (seconds <= 0) {
      clearInterval(turnTimer);
      handleTurnTimeout(); // 超时处理（Issue #14）
    }
  }, 1000);
}

// 强制刷新倒计时显示
function refreshCountdownDisplay() {
  const countdownEl = document.getElementById('turnCountdown');
  if (countdownEl) {
    countdownEl.textContent = TURN_DURATION;
    countdownEl.classList.remove('warning');
    console.log(`⏱️ 倒计时已重置为: ${TURN_DURATION} 秒`);
  } else {
    console.warn('⚠️ 找不到 turnCountdown 元素');
  }
}

// 处理回合超时（Issue #14）
function handleTurnTimeout() {
  console.log('⏰ 回合超时，检查是否需要托管');
  
  // 只有当当前轮到真人玩家且未处于托管状态时，才开启托管
  const currentTurnEl = document.getElementById('currentTurn');
  if (!currentTurnEl) return;
  
  const players = window.currentPlayers;
  if (!players) return;
  
  const currentPlayerName = currentTurnEl.textContent;
  const currentPlayer = players.find(p => p.name === currentPlayerName);
  
  // 如果是 Bot 超时，先显示托管标签，然后立即执行动作 (Issue #17)
  if (currentPlayer && currentPlayer.isBot) {
    console.log(`🤖 Bot ${currentPlayer.name} 超时，进入托管并执行动作`);
    // 在 UI 上显示该 Bot 的托管状态
    const botIndex = players.findIndex(p => p.name === currentPlayerName);
    if (botIndex !== -1) {
      const botLabel = document.getElementById(`autoPlayLabel-${botIndex}`);
      if (botLabel) botLabel.classList.remove('hidden');
    }
    
    // 延迟一点点再执行，让 UI 有机会渲染出托管标签
    setTimeout(() => {
      performBotAction();
    }, 500);
    return;
  }
  
  // 如果是真人超时，进入托管模式
  if (!isAutoPlay) {
    toggleAutoPlay(true); // 自动开启托管
  }
  
  // 执行自动操作
  performAutoAction();
}

// 强制触发超时处理（用于调试或页面恢复后卡死的情况）
function forceTimeoutHandling() {
  console.log('🔧 强制触发超时处理');
  handleTurnTimeout();
}

// 执行自动操作（Issue #14 & #17）
function performAutoAction() {
  const handCards = document.getElementById('handCards');
  const drawCardBtn = document.getElementById('drawCardBtn');
  
  if (!handCards || !drawCardBtn) return;
  
  // 简单策略：优先出牌，无牌可出则抓牌
  if (handCards.children.length > 0) {
    // 随机选一张出
    const cards = Array.from(handCards.children);
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    randomCard.click(); // 选中
    setTimeout(() => {
      const playBtn = document.getElementById('playCardBtn');
      if (playBtn && !playBtn.disabled) {
        playBtn.click();
      }
    }, 500);
  } else if (!drawCardBtn.disabled && deckCount > 0) {
    drawCardBtn.click();
  }
}

// 执行 Bot 行为 (Issue #17 - Phase 2: Strategy)
function performBotAction() {
  const players = window.currentPlayers;
  if (!players) return;
  
  // 获取当前回合的 Bot 信息
  const currentTurnEl = document.getElementById('currentTurn');
  if (!currentTurnEl) return;
  
  const currentPlayerName = currentTurnEl.textContent;
  const currentPlayerIndex = players.findIndex(p => p.name === currentPlayerName);
  const currentPlayer = players[currentPlayerIndex];
  
  if (!currentPlayer || !currentPlayer.isBot) return;
  
  // 获取该 Bot 当前的手牌数
  const botHandCount = window.playerHandCounts[currentPlayerIndex] || 0;
  
  console.log(`🤖 [决策] Bot ${currentPlayer.name} (索引:${currentPlayerIndex}) 手牌数:${botHandCount}`);
  
  // Bot 策略：只有出牌和抓牌两个操作 (Issue #17)
  const actions = [];
  if (botHandCount > 0) actions.push('play');
  if (deckCount > 0) actions.push('draw');
    
  // 如果既没有手牌也没有底牌，标记为 'none'
  const choice = actions.length > 0 ? actions[Math.floor(Math.random() * actions.length)] : 'none';
  console.log(`🤖 [决策] Bot 选择了: ${choice}`);
  
  if (choice === 'play') {
    // Bot 出牌：减少手牌数，增加公示区卡牌
    console.log(`🤖 Bot ${currentPlayer.name} 决定出牌`);
    
    // 更新手牌数
    const newCount = botHandCount - 1;
    updatePlayerHandCount(currentPlayerIndex, newCount);
    
    console.log(`✅ Bot ${currentPlayer.name} 手牌数已更新为: ${newCount}`);
    
    // 添加到公示区
    const cardTypes = Object.values(CARD_TYPES);
    const randomCard = cardTypes[Math.floor(Math.random() * cardTypes.length)];
    addPlayedCard({ icon: randomCard.icon, name: randomCard.name }, {
      name: currentPlayer.name,
      avatar: currentPlayer.avatar
    });
    
    // 延迟后切换回合
    setTimeout(() => {
      advanceTurn();
    }, 1500);
    
  } else if (choice === 'draw') {
    // Bot 抓牌：减少底牌数，增加手牌数
    console.log(`🤖 Bot ${currentPlayer.name} 决定抓牌`);
    
    // 更新底牌数
    deckCount--;
    updateDeckDisplay();
    
    // 更新手牌数
    const newCount = botHandCount + 1;
    updatePlayerHandCount(currentPlayerIndex, newCount);
    
    console.log(`✅ Bot ${currentPlayer.name} 手牌数已更新为: ${newCount}`);
    
    // 延迟后切换回合
    setTimeout(() => {
      advanceTurn();
    }, 1500);
    
  } else {
    // 既没手牌也没底牌，立即跳过该 Bot 的回合
    console.log(`🤖 Bot ${currentPlayer.name} 无牌可出/可抓，跳过回合`);
    setTimeout(() => {
      advanceTurn();
    }, 500);
  }
}

// 推进回合（模拟服务器逻辑）
function advanceTurn() {
  const indicator = document.getElementById('turnIndicator');
  if (!indicator) return;
  
  // 获取当前玩家索引
  const currentTurnEl = document.getElementById('currentTurn');
  if (!currentTurnEl) return;
  
  const players = window.currentPlayers;
  if (!players) return;
  
  const currentPlayerName = currentTurnEl.textContent;
  const currentIndex = players.findIndex(p => p.name === currentPlayerName);
  
  if (currentIndex !== -1) {
    const nextIndex = (currentIndex + 1) % players.length;
    updateTurnIndicator(nextIndex, players);
    
    // 清除旧的定时器并启动新的
    if (window.turnIntervalId) {
      clearInterval(window.turnIntervalId);
    }
    
    // 重新启动轮换（但这次我们只用来更新 UI，实际切换由 advanceTurn 控制）
    // 为了防止重复计时，我们这里不直接调用 startTurnRotation，而是手动触发一次 UI 更新
    // 真正的计时器在 updateTurnIndicator 里的 resetTurnCountdown 已经启动了
  }
}

function startTurnRotation(players) {
  let currentIndex = 0;
  
  // 使用重新排序后的玩家列表
  const displayPlayers = window.currentPlayers || players;
  
  // 初始显示
  updateTurnIndicator(currentIndex, displayPlayers);
  
  // 每3秒轮换一次（模拟回合结束，实际应由服务器控制）
  const turnInterval = setInterval(() => {
    currentIndex = (currentIndex + 1) % displayPlayers.length;
    updateTurnIndicator(currentIndex, displayPlayers);
  }, 15000); // 改为15秒，与倒计时同步
  
  // 暴露 interval ID 以便清理（如果需要）
  window.turnIntervalId = turnInterval;
}

// 生成初始手牌和底牌（Issue #20）
function generateInitialCards() {
  console.log('🎴 [Issue #20] 开始生成初始牌组...');
  
  const playerCount = MATCH_TARGET; // 5名玩家
  const handSize = 5;
  const deckSize = 28;
  const totalSwapLimit = 4;
  const bombInDeck = 4;

  // 1. 初始化所有玩家的空手牌
  const allHands = [];
  for (let i = 0; i < playerCount; i++) {
    allHands.push([]);
  }

  // 规则1：每个玩家必然含有1张洛阳铲
  for (let i = 0; i < playerCount; i++) {
    allHands[i].push(CARD_TYPES.SHOVEL);
  }

  // 填充剩余手牌位置（不含炸弹）
  const availableForHand = Object.values(CARD_TYPES).filter(t => t.id !== 'bomb');
  for (let i = 0; i < playerCount; i++) {
    while (allHands[i].length < handSize) {
      const randomCard = availableForHand[Math.floor(Math.random() * availableForHand.length)];
      allHands[i].push(randomCard);
    }
  }

  // 2. 生成底牌堆
  const deck = [];
  
  // 规则3：底牌中的炸弹牌为4张
  for (let i = 0; i < bombInDeck; i++) {
    deck.push(CARD_TYPES.BOMB);
  }

  // 规则2：全场 SWAP 总数为 4 张。先统计手牌中已有的 SWAP。
  let currentSwapCount = 0;
  allHands.forEach(hand => {
    currentSwapCount += hand.filter(c => c.id === 'swap').length;
  });

  // 在底牌中补足剩余的 SWAP，确保总数为 4
  const remainingSwap = Math.max(0, totalSwapLimit - currentSwapCount);
  for (let i = 0; i < remainingSwap; i++) {
    deck.push(CARD_TYPES.SWAP);
  }

  // 填充底牌剩余位置
  const remainingDeckSlots = deckSize - bombInDeck - remainingSwap;
  const fillTypes = Object.values(CARD_TYPES).filter(t => t.id !== 'bomb' && t.id !== 'swap');
  for (let i = 0; i < remainingDeckSlots; i++) {
    const randomCard = fillTypes[Math.floor(Math.random() * fillTypes.length)];
    deck.push(randomCard);
  }

  // 3. 统计日志（Issue #20：测试时显示各类牌的数量）
  const myHand = allHands[0]; // 假设自己是第一个玩家
  const allCards = [...myHand, ...deck];
  const stats = {};
  
  console.group('🎴 [Issue #20] 初始发牌统计报告');
  console.log('🃏 我的手牌详情:', myHand.map(c => c.name));
  console.log('🗂️ 底牌堆总数量:', deck.length);
  console.log('👥 玩家总数:', playerCount);
  console.log('🔄 偷梁换柱总数限制:', totalSwapLimit);
  
  // 统计所有牌（包括所有玩家的手牌和底牌）
  const globalAllCards = [...deck];
  allHands.forEach(h => globalAllCards.push(...h));
  
  Object.values(CARD_TYPES).forEach(type => {
    const count = globalAllCards.filter(c => c.id === type.id).length;
    stats[type.name] = count;
    console.log(`   - ${type.name}: ${count} 张`);
  });
  console.groupEnd();
  
  return {
    myCards: myHand,
    deckCards: deck,
    stats: stats
  };
}

function initHandArea(predefinedCards = null) {
  const handCards = document.getElementById('handCards');
  const cardCount = document.getElementById('cardCount');
  const drawCardBtn = document.getElementById('drawCardBtn');
  const playCardBtn = document.getElementById('playCardBtn');
  
  if (!handCards || !cardCount || !drawCardBtn || !playCardBtn) return;
  
  // 模拟手牌数据（Issue #20：使用生成的初始手牌）
  const myCards = predefinedCards || [];
  
  // 如果没有预定义的手牌，则生成默认手牌（兼容旧逻辑）
  if (myCards.length === 0) {
    const cardTypeKeys = Object.keys(CARD_TYPES);
    for (let i = 0; i < 5; i++) {
      const randomKey = cardTypeKeys[Math.floor(Math.random() * cardTypeKeys.length)];
      myCards.push(CARD_TYPES[randomKey]);
    }
  }
  
  // 清空手牌区域
  handCards.innerHTML = '';
  
  myCards.forEach((cardType, index) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'hand-card';
    cardDiv.dataset.cardId = Date.now() + index; // 唯一标识
    cardDiv.dataset.cardType = cardType.id; // 保存牌型ID
    
    // 添加图标和名称
    const iconSpan = document.createElement('span');
    iconSpan.className = 'card-icon';
    iconSpan.textContent = cardType.icon;
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'card-name';
    nameSpan.textContent = cardType.name;
    
    cardDiv.appendChild(iconSpan);
    cardDiv.appendChild(nameSpan);
    
    cardDiv.title = cardType.name;
    cardDiv.style.animation = `dealCard 0.5s ease-out ${index * 0.1}s both`;
    
    // 添加点击选中功能（Issue #10）
    cardDiv.addEventListener('click', () => {
      const isSelected = cardDiv.classList.contains('selected');
      handCards.querySelectorAll('.hand-card').forEach(c => c.classList.remove('selected'));
      if (!isSelected) {
        cardDiv.classList.add('selected');
      }
    });
    
    handCards.appendChild(cardDiv);
  });
  
  cardCount.textContent = String(myCards.length);
  drawCardBtn.disabled = true; // 初始禁用，等待回合开始
  playCardBtn.disabled = true;
  
  // 抽牌按钮事件
  drawCardBtn.addEventListener('click', () => {
    if (drawCardBtn.disabled) {
      alert('现在不是你的回合，无法抽牌！');
      return;
    }
    
    // 从底牌堆抽牌（Issue #8）
    const drawnCard = drawCardFromDeck();
    
    if (drawnCard) {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'hand-card';
      cardDiv.dataset.cardId = Date.now(); // 唯一标识
      cardDiv.dataset.cardType = drawnCard.id; // 保存牌型ID
      
      // 添加图标和名称
      const iconSpan = document.createElement('span');
      iconSpan.className = 'card-icon';
      iconSpan.textContent = drawnCard.icon;
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'card-name';
      nameSpan.textContent = drawnCard.name;
      
      cardDiv.appendChild(iconSpan);
      cardDiv.appendChild(nameSpan);
      
      cardDiv.title = drawnCard.name;
      
      // 添加点击选中功能（Issue #10）
      cardDiv.addEventListener('click', () => {
        // 切换选中状态
        const isSelected = cardDiv.classList.contains('selected');
        
        // 清除其他牌的选中状态（单选模式）
        handCards.querySelectorAll('.hand-card').forEach(c => c.classList.remove('selected'));
        
        if (!isSelected) {
          cardDiv.classList.add('selected');
        }
      });
      
      cardDiv.style.animation = 'dealCard 0.5s ease-out';
      handCards.appendChild(cardDiv);
      cardCount.textContent = String(handCards.children.length);
      
      cardDiv.addEventListener('animationend', () => {
        cardDiv.classList.add('dealt');
      });
      
      playCardBtn.disabled = false;
      
      // 抓牌后禁用出牌按钮（本回合只能二选一，抓牌后回合结束）
      drawCardBtn.disabled = true;
      
      // 抓牌后自动结束回合（Issue #13：每轮只能二选一）
      // 增加延迟确保 UI 更新完成
      setTimeout(() => {
        advanceTurn();
      }, 1500);
    } else {
      alert('底牌堆已空，无法抽牌！');
      drawCardBtn.disabled = true;
      playCardBtn.disabled = true; // 没牌可抽也没牌可出
    }
  });
  
  // 出牌按钮事件
  playCardBtn.addEventListener('click', () => {
    if (playCardBtn.disabled) {
      alert('现在不是你的回合，无法出牌！');
      return;
    }
    
    const cards = handCards.querySelectorAll('.hand-card');
    if (cards.length === 0) {
      alert('没有手牌可以出！');
      return;
    }
    
    // 查找选中的牌（Issue #10）
    const selectedCard = handCards.querySelector('.hand-card.selected');
    const cardToPlay = selectedCard || cards[cards.length - 1]; // 如果没有选中，默认出最后一张
    
    // 获取卡牌信息（从子元素中提取图标和名称）
    const iconSpan = cardToPlay.querySelector('.card-icon');
    const nameSpan = cardToPlay.querySelector('.card-name');
    const cardIcon = iconSpan ? iconSpan.textContent : cardToPlay.textContent;
    const cardName = nameSpan ? nameSpan.textContent : (cardToPlay.title || '未知牌');
    const cardType = cardToPlay.dataset.cardType || '';
    
    // 播放出牌动画
    cardToPlay.style.animation = 'playCard 0.5s ease-out forwards';
    
    setTimeout(() => {
      // 添加到公示区（Issue #11）
      const playerInfo = getCurrentPlayerInfo();
      const cardData = { icon: cardIcon, name: cardName };
      addPlayedCard(cardData, playerInfo);
      
      // 从手牌中移除
      cardToPlay.remove();
      cardCount.textContent = String(handCards.children.length);
      
      // 清除选中状态
      handCards.querySelectorAll('.hand-card').forEach(c => c.classList.remove('selected'));
      
      // 出牌后禁用按钮并结束回合
      playCardBtn.disabled = true;
      drawCardBtn.disabled = true; // 出牌后本回合不能再抓牌
      
      // 出牌后自动结束回合（Issue #13：每轮只能二选一）
      // 增加延迟确保动画和 UI 更新完成
      setTimeout(() => {
        advanceTurn();
      }, 1500);
    }, 500);
  });
}

// 更新玩家手牌数量显示
function updatePlayerHandCount(playerIndex, newCount) {
  if (!window.playerHandCounts) return;
  
  window.playerHandCounts[playerIndex] = newCount;
  
  // 如果是自己，更新手牌区域
  const players = window.currentPlayers || getStoredMatch();
  if (players && players[playerIndex] && players[playerIndex].self) {
    const cardCount = document.getElementById('cardCount');
    if (cardCount) {
      cardCount.textContent = String(newCount);
    }
  } else {
    // 更新其他玩家的手牌数量徽章
    const playerEl = document.querySelector(`.player-position[data-index="${playerIndex}"]`);
    if (playerEl) {
      const badge = playerEl.querySelector('.hand-count-badge');
      if (badge) {
        // 添加更新动画
        badge.style.animation = 'none';
        setTimeout(() => {
          badge.textContent = newCount;
          badge.style.animation = 'badgePop 0.3s ease-out';
        }, 10);
      }
    }
  }
}

// 出牌公示区管理（Issue #11）
let playedCards = [];

function initPlayArea() {
  const container = document.getElementById('playedCardsContainer');
  if (!container) return;
  
  // 从 localStorage 恢复已打出的牌
  const storedPlayed = localStorage.getItem('playedCards');
  if (storedPlayed) {
    try {
      playedCards = JSON.parse(storedPlayed);
      renderPlayedCards();
    } catch (e) {
      console.error('恢复已打牌失败', e);
    }
  }
}

function addPlayedCard(card, playerInfo) {
  const container = document.getElementById('playedCardsContainer');
  
  if (!container) return;
  
  // 添加到记录
  playedCards.push({ card, player: playerInfo, timestamp: Date.now() });
  
  // 保存到 localStorage
  localStorage.setItem('playedCards', JSON.stringify(playedCards));
  
  // 渲染
  renderPlayedCards();
}

function renderPlayedCards() {
  const container = document.getElementById('playedCardsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  // 只显示最近一次打出的牌（Issue #11：只显示最新的一张）
  if (playedCards.length === 0) {
    container.innerHTML = '<div style="color: rgba(255,255,255,0.5); font-size: 0.9rem;">出牌区</div>';
    return;
  }
  
  const latestCard = playedCards[playedCards.length - 1];
  const cardDiv = document.createElement('div');
  cardDiv.className = 'played-card latest';
  
  // 添加图标和名称
  const iconSpan = document.createElement('span');
  iconSpan.className = 'card-icon';
  iconSpan.textContent = latestCard.card.icon;
  
  const nameSpan = document.createElement('span');
  nameSpan.className = 'card-name';
  nameSpan.textContent = latestCard.card.name;
  
  cardDiv.appendChild(iconSpan);
  cardDiv.appendChild(nameSpan);
  
  // 检查是否是特殊牌型（如炸弹）
  if (latestCard.card.icon === '💣') {
    cardDiv.classList.add('special-effect');
  }
  
  cardDiv.title = `${latestCard.player.name}: ${latestCard.card.name}`;
  container.appendChild(cardDiv);
}

function updateLastPlayInfo(playerInfo) {
  const lastPlayInfo = document.getElementById('lastPlayInfo');
  if (!lastPlayInfo) return;
  
  lastPlayInfo.innerHTML = `
    <img class="player-avatar-small" src="${playerInfo.avatar}" alt="${playerInfo.name}" />
    <span>${escapeHtml(playerInfo.name)} 刚刚出牌</span>
  `;
}

// 模拟当前玩家信息（实际应从用户数据获取）
function getCurrentPlayerInfo() {
  const user = getStoredUser();
  if (!user) return { name: '我', avatar: 'https://api.dicebear.com/5.x/thumbs/svg?seed=me' };
  return {
    name: user.name,
    avatar: user.avatar || `https://api.dicebear.com/5.x/thumbs/svg?seed=${encodeURIComponent(user.name)}`
  };
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

// 初始化托管功能（Issues #14, #15）
function initAutoPlay() {
  // 页面任意点击退出托管（Issue #15）
  document.addEventListener('click', handleExitAutoPlay);
}

// 切换托管状态（Issue #15）
function toggleAutoPlay(enable) {
  isAutoPlay = enable;
  
  // 找到当前玩家的索引
  const players = window.currentPlayers;
  if (!players) return;
  
  const selfPlayerIndex = players.findIndex(p => p.self);
  if (selfPlayerIndex === -1) return;
  
  // 更新当前玩家头像上的标签
  const autoPlayLabel = document.getElementById(`autoPlayLabel-${selfPlayerIndex}`);
  const handArea = document.getElementById('handArea');
  
  if (autoPlayLabel) {
    if (isAutoPlay) {
      autoPlayLabel.classList.remove('hidden');
    } else {
      autoPlayLabel.classList.add('hidden');
    }
  }
  
  // 更新手牌区样式提示（Issue #15）
  if (handArea) {
    if (isAutoPlay) {
      handArea.style.opacity = '0.6';
      handArea.style.pointerEvents = 'none'; // 托管时禁止手动操作
    } else {
      handArea.style.opacity = '1';
      handArea.style.pointerEvents = 'auto';
    }
  }
  
  console.log(`🤖 托管状态: ${isAutoPlay ? '开启' : '关闭'}`);
}

// 处理退出托管（Issue #15）
function handleExitAutoPlay(event) {
  if (!isAutoPlay) return;
  
  // 任意点击都标记为“请求在下一轮恢复手动”
  pendingManualResume = true;
  console.log('👆 检测到手动操作，将在下一轮恢复手操');
  
  // UI 立即给出反馈，但逻辑上等到下一轮才真正解除 isAutoPlay
  const handArea = document.getElementById('handArea');
  if (handArea) {
    handArea.style.animation = 'none';
    setTimeout(() => {
      handArea.style.animation = 'highlightPop 0.6s ease-out';
    }, 10);
  }
}

// 回合开始时检查是否需要恢复手动（Issue #15）或触发 Bot 行为 (Issue #17)
function checkManualResume() {
  if (pendingManualResume) {
    toggleAutoPlay(false);
    pendingManualResume = false;
    console.log('✅ 已恢复手动操作模式');
  }
  
  // 如果当前轮到 Bot，触发 Bot 行为
  const currentTurnEl = document.getElementById('currentTurn');
  if (!currentTurnEl) return;
  
  const players = window.currentPlayers;
  if (!players) return;
  
  const currentPlayerName = currentTurnEl.textContent;
  const currentPlayer = players.find(p => p.name === currentPlayerName);
  
  if (currentPlayer && currentPlayer.isBot) {
    const thinkTime = 1000 + Math.random() * 2000; // 模拟思考时间 1-3 秒
    console.log(`🤖 [调试] Bot ${currentPlayer.name} 轮次开始，预计思考 ${thinkTime}ms`);
    setTimeout(() => {
      performBotAction();
    }, thinkTime);
  } else if (currentPlayer && !currentPlayer.self) {
    // 如果是其他真人玩家（模拟情况），暂时跳过
    console.log(`👤 轮到其他玩家: ${currentPlayerName}`);
  }
}

function initGame() {
  const user = getStoredUser();
  renderUserBadge(user);

  // 清理上一局的残留数据（Issue #3：重新匹配后底牌重置）
  localStorage.removeItem('deckCount');
  localStorage.removeItem('playedCards');
  deckCount = 28; // 重置全局变量
  playedCards = [];
  isAutoPlay = false; // 重置托管状态
  pendingManualResume = false; // 重置手动恢复标记

  // 执行初始发牌逻辑（Issue #20）
  const cardDistribution = generateInitialCards();
  console.log('🎴 [Issue #20] 初始发牌统计:', cardDistribution);

  let players = getStoredMatch();
  if (!players || players.length < MATCH_TARGET) {
    window.location.href = 'index.html';
    return;
  }

  // 添加在线状态（默认为在线）并补足 Bot
  players = players.map(p => ({
    ...p,
    online: true,
    isBot: p.isBot || false
  }));

  // 如果人数不足，自动补足 Bot (Issue #17)
  // 注意：由于匹配环节已经补足了，这里主要是为了防止意外情况
  while (players.length < MATCH_TARGET) {
    players.push(randomOtherPlayer(players.length, true));
  }

  // 渲染游戏桌和玩家环形布局（会自动重新排序，自己在底部）
  renderGameTable(players);
  
  // 初始化底牌堆（Issue #8）
  initDeckPile();
  
  // 渲染8种牌型展示（Issue #8）
  renderCardTypes();
  
  // 初始化出牌公示区（Issue #11）
  initPlayArea();
  
  // 初始化手牌区域（使用 Issue #20 生成的手牌）
  initHandArea(cardDistribution.myCards);
  
  // 初始化离开房间按钮
  initLeaveRoom();
  
  // 初始化托管功能（Issues #14, #15）
  initAutoPlay();
  
  // 初始化游戏状态管理
  initGameStateManagement();
  
  // 启动回合轮换动画（使用重新排序后的玩家列表）
  startTurnRotation(window.currentPlayers || players);
  
  // 确保托管标签初始状态正确
  const currentPlayerList = window.currentPlayers || players;
  if (currentPlayerList) {
    const selfPlayerIndex = currentPlayerList.findIndex(p => p.self);
    if (selfPlayerIndex !== -1) {
      const autoPlayLabel = document.getElementById(`autoPlayLabel-${selfPlayerIndex}`);
      if (autoPlayLabel) {
        if (!isAutoPlay) {
          autoPlayLabel.classList.add('hidden');
          console.log('🏷️ 托管标签已隐藏');
        } else {
          autoPlayLabel.classList.remove('hidden');
          console.log('🏷️ 托管标签已显示');
        }
      }
    }
  }
  
  // 强制刷新倒计时显示，确保显示为 5 秒
  refreshCountdownDisplay();
  
  // 调试：检查 DOM 元素是否存在
  console.log('🔍 DOM 检查:');
  console.log('- turnCountdown:', document.getElementById('turnCountdown'));
  console.log('- autoPlayLabel:', document.getElementById('autoPlayLabel'));
  console.log('- playedCardsContainer:', document.getElementById('playedCardsContainer'));
  
  // 强制刷新一次出牌区显示
  renderPlayedCards();
  
  // 调试：检查手牌区和按钮状态
  console.log('🃏 游戏元素状态:');
  console.log('- handArea:', document.getElementById('handArea'));
  console.log('- drawCardBtn (disabled):', document.getElementById('drawCardBtn')?.disabled);
  console.log('- playCardBtn (disabled):', document.getElementById('playCardBtn')?.disabled);
  
  // ========== 测试功能：在控制台暴露函数 ==========
  // 使用方法：在浏览器控制台输入 testUpdateHandCount(0, 7) 来更新玩家0的手牌数为7
  window.testUpdateHandCount = updatePlayerHandCount;
  
  // 测试出牌公示区
  window.testAddPlayedCard = (icon, name) => {
    const playerInfo = getCurrentPlayerInfo();
    addPlayedCard({ icon, name }, playerInfo);
  };
  
  console.log('✅ 游戏房间已加载');
  console.log('📝 测试命令: testUpdateHandCount(playerIndex, newCount)');
  console.log('   例如: testUpdateHandCount(1, 5) - 将玩家1的手牌数更新为5');
  console.log('💡 提示: 自己的头像在底部，与手牌相邻');
  console.log('🃏 测试出牌: testAddPlayedCard("💣", "炸弹")');
  
  // 调试信息：确认倒计时和托管状态
  console.log(`⏱️ 当前倒计时设置: ${TURN_DURATION} 秒`);
  console.log(`🤖 初始托管状态: ${isAutoPlay}`);
  
  // Bot 调试日志 (Issue #18)
  const bots = players.filter(p => p.isBot);
  if (bots.length > 0) {
    console.log(`🤖 [调试] 房间内共有 ${bots.length} 个 Bot:`, bots.map(b => b.name).join(', '));
  }
  
  // 暴露强制超时处理函数到全局（用于调试）
  window.forceTimeoutHandling = forceTimeoutHandling;
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
