// AI KMS Frontend Application

let authToken = null;
let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
  checkAuthState();
});

function initializeApp() {
  // Load auth token from localStorage
  authToken = localStorage.getItem('authToken');
  const userStr = localStorage.getItem('currentUser');
  
  if (userStr) {
    try {
      currentUser = JSON.parse(userStr);
    } catch (e) {
      console.error('Failed to parse user data:', e);
    }
  }
}

function setupEventListeners() {
  // Login/Logout/Register
  document.getElementById('loginBtn').addEventListener('click', showLoginModal);
  document.getElementById('registerBtn').addEventListener('click', showRegisterModal);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('closeLoginBtn').addEventListener('click', hideLoginModal);
  document.getElementById('closeRegisterBtn').addEventListener('click', hideRegisterModal);
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
  document.getElementById('switchToRegister').addEventListener('click', () => {
    hideLoginModal();
    showRegisterModal();
  });
  document.getElementById('switchToLogin').addEventListener('click', () => {
    hideRegisterModal();
    showLoginModal();
  });
  
  // Chat
  document.getElementById('sendBtn').addEventListener('click', sendQuestion);
  document.getElementById('questionInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  });
  
  // Navigation
  document.getElementById('historyBtn').addEventListener('click', showHistory);
  document.getElementById('documentsBtn').addEventListener('click', showDocuments);
}

function checkAuthState() {
  if (authToken && currentUser) {
    updateUIForLoggedIn();
    loadStats();
  } else {
    updateUIForLoggedOut();
  }
}

function updateUIForLoggedIn() {
  document.getElementById('loginBtn').classList.add('hidden');
  document.getElementById('registerBtn').classList.add('hidden');
  document.getElementById('logoutBtn').classList.remove('hidden');
  document.getElementById('userInfo').classList.remove('hidden');
  document.getElementById('userName').textContent = currentUser.name;
  document.getElementById('questionInput').disabled = false;
  document.getElementById('sendBtn').disabled = false;
  
  if (currentUser.role === 'admin') {
    document.getElementById('documentsBtn').classList.remove('hidden');
  }
  
  // Clear welcome message
  const chatMessages = document.getElementById('chatMessages');
  chatMessages.innerHTML = '';
}

function updateUIForLoggedOut() {
  document.getElementById('loginBtn').classList.remove('hidden');
  document.getElementById('registerBtn').classList.remove('hidden');
  document.getElementById('logoutBtn').classList.add('hidden');
  document.getElementById('userInfo').classList.add('hidden');
  document.getElementById('documentsBtn').classList.add('hidden');
  document.getElementById('questionInput').disabled = true;
  document.getElementById('sendBtn').disabled = true;
}

function showLoginModal() {
  document.getElementById('loginModal').classList.remove('hidden');
}

function hideLoginModal() {
  document.getElementById('loginModal').classList.add('hidden');
  document.getElementById('loginForm').reset();
}

function showRegisterModal() {
  document.getElementById('registerModal').classList.remove('hidden');
}

function hideRegisterModal() {
  document.getElementById('registerModal').classList.add('hidden');
  document.getElementById('registerForm').reset();
}

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    const response = await axios.post('/api/auth/login', {
      email,
      password
    });
    
    authToken = response.data.token;
    currentUser = response.data.user;
    
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    hideLoginModal();
    checkAuthState();
    
    showNotification('로그인 성공!', 'success');
  } catch (error) {
    console.error('Login failed:', error);
    showNotification('로그인 실패: ' + (error.response?.data?.error || '알 수 없는 오류'), 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  
  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
  
  // Validate password match
  if (password !== passwordConfirm) {
    showNotification('비밀번호가 일치하지 않습니다', 'error');
    return;
  }
  
  // Validate password length
  if (password.length < 6) {
    showNotification('비밀번호는 최소 6자 이상이어야 합니다', 'error');
    return;
  }
  
  try {
    const response = await axios.post('/api/auth/register', {
      email,
      password,
      name,
      role: 'user'
    });
    
    hideRegisterModal();
    showNotification('회원가입 성공! 로그인해주세요.', 'success');
    
    // Auto-fill login form
    document.getElementById('loginEmail').value = email;
    setTimeout(() => showLoginModal(), 500);
  } catch (error) {
    console.error('Registration failed:', error);
    showNotification('회원가입 실패: ' + (error.response?.data?.error || '알 수 없는 오류'), 'error');
  }
}

function handleLogout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  
  checkAuthState();
  
  // Reset chat
  const chatMessages = document.getElementById('chatMessages');
  chatMessages.innerHTML = `
    <div class="text-center text-gray-500 py-12">
      <i class="fas fa-robot text-6xl text-blue-200 mb-4"></i>
      <p class="text-lg font-medium mb-2">AI 지식 관리 시스템에 오신 것을 환영합니다</p>
      <p class="text-sm">문서 기반 질문에 대해 AI가 정확한 답변을 제공합니다</p>
    </div>
  `;
  
  showNotification('로그아웃되었습니다', 'info');
}

async function sendQuestion() {
  if (!authToken) {
    showNotification('로그인이 필요합니다', 'error');
    return;
  }
  
  const input = document.getElementById('questionInput');
  const question = input.value.trim();
  
  if (!question) {
    return;
  }
  
  // Disable input
  input.disabled = true;
  document.getElementById('sendBtn').disabled = true;
  
  // Add user message
  addMessage('user', question);
  
  // Add loading message
  const loadingId = addLoadingMessage();
  
  // Clear input
  input.value = '';
  
  try {
    const response = await axios.post(
      '/api/query',
      { question },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );
    
    // Remove loading message
    removeLoadingMessage(loadingId);
    
    // Add AI response
    addMessage('ai', response.data.answer, response.data.sources, response.data.response_time_ms);
    
    // Update stats
    loadStats();
  } catch (error) {
    console.error('Query failed:', error);
    removeLoadingMessage(loadingId);
    addMessage('ai', '죄송합니다. 질문을 처리하는 중 오류가 발생했습니다. 다시 시도해주세요.', [], 0);
    showNotification('질문 처리 실패: ' + (error.response?.data?.error || '알 수 없는 오류'), 'error');
  } finally {
    // Re-enable input
    input.disabled = false;
    document.getElementById('sendBtn').disabled = false;
    input.focus();
  }
}

function addMessage(type, content, sources = [], responseTime = 0) {
  const chatMessages = document.getElementById('chatMessages');
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message flex ${type === 'user' ? 'justify-end' : 'justify-start'}`;
  
  let html = '';
  
  if (type === 'user') {
    html = `
      <div class="bg-blue-600 text-white px-4 py-3 rounded-lg max-w-xl">
        <p class="text-sm">${escapeHtml(content)}</p>
      </div>
    `;
  } else {
    html = `
      <div class="bg-gray-100 px-4 py-3 rounded-lg max-w-2xl">
        <div class="flex items-start mb-2">
          <i class="fas fa-robot text-blue-600 mr-2 mt-1"></i>
          <div class="flex-1">
            <p class="text-sm text-gray-800 whitespace-pre-wrap">${escapeHtml(content)}</p>
          </div>
        </div>
        ${sources.length > 0 ? `
          <div class="mt-3 pt-3 border-t border-gray-300">
            <p class="text-xs font-semibold text-gray-600 mb-2">
              <i class="fas fa-book mr-1"></i>참고 문서:
            </p>
            <div class="space-y-1">
              ${sources.map(source => `
                <div class="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                  <i class="fas fa-file-alt mr-1"></i>${escapeHtml(source.title)}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        ${responseTime > 0 ? `
          <p class="text-xs text-gray-500 mt-2">
            <i class="fas fa-clock mr-1"></i>응답 시간: ${(responseTime / 1000).toFixed(2)}초
          </p>
        ` : ''}
      </div>
    `;
  }
  
  messageDiv.innerHTML = html;
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addLoadingMessage() {
  const chatMessages = document.getElementById('chatMessages');
  const loadingId = 'loading-' + Date.now();
  
  const messageDiv = document.createElement('div');
  messageDiv.id = loadingId;
  messageDiv.className = 'chat-message flex justify-start';
  messageDiv.innerHTML = `
    <div class="bg-gray-100 px-4 py-3 rounded-lg">
      <div class="flex items-center">
        <i class="fas fa-robot text-blue-600 mr-2"></i>
        <span class="text-sm text-gray-600 loading-dots">답변 생성 중</span>
      </div>
    </div>
  `;
  
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  return loadingId;
}

function removeLoadingMessage(loadingId) {
  const loadingMsg = document.getElementById(loadingId);
  if (loadingMsg) {
    loadingMsg.remove();
  }
}

async function loadStats() {
  if (!authToken) return;
  
  try {
    // This is a placeholder - in production, create an API endpoint for stats
    document.getElementById('docCount').textContent = '-';
    document.getElementById('queryCount').textContent = '-';
    document.getElementById('avgResponse').textContent = '-';
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

async function showHistory() {
  if (!authToken) {
    showNotification('로그인이 필요합니다', 'error');
    return;
  }
  
  try {
    const response = await axios.get('/api/query/history', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    // Clear chat and show history
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '<h3 class="text-lg font-bold mb-4">질문 히스토리</h3>';
    
    if (response.data.queries.length === 0) {
      chatMessages.innerHTML += '<p class="text-gray-500">아직 질문 기록이 없습니다.</p>';
      return;
    }
    
    response.data.queries.forEach(query => {
      addMessage('user', query.question);
      if (query.answer) {
        const sources = query.sources ? JSON.parse(query.sources) : [];
        addMessage('ai', query.answer, sources, query.response_time_ms);
      }
    });
  } catch (error) {
    console.error('Failed to load history:', error);
    showNotification('히스토리 로드 실패', 'error');
  }
}

function showDocuments() {
  if (!authToken || currentUser.role !== 'admin') {
    showNotification('관리자 권한이 필요합니다', 'error');
    return;
  }
  
  // This would open a document management interface
  showNotification('문서 관리 기능은 개발 중입니다', 'info');
}

function showNotification(message, type = 'info') {
  // Simple notification - in production, use a proper notification library
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  };
  
  const notification = document.createElement('div');
  notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
