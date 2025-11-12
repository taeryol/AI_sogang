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
  
  // Document Upload
  document.getElementById('uploadBtn').addEventListener('click', handleDocumentUpload);
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
  
  // Show upload form
  document.getElementById('uploadLoginPrompt').classList.add('hidden');
  document.getElementById('uploadForm').classList.remove('hidden');
  
  // Show documents list
  document.getElementById('documentsListSection').classList.remove('hidden');
  loadDocumentsList();
  
  if (currentUser.role === 'admin') {
    document.getElementById('documentsBtn').classList.remove('hidden');
    document.getElementById('adminPageBtn').classList.remove('hidden');
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
  document.getElementById('adminPageBtn').classList.add('hidden');
  document.getElementById('questionInput').disabled = true;
  document.getElementById('sendBtn').disabled = true;
  
  // Hide upload form
  document.getElementById('uploadLoginPrompt').classList.remove('hidden');
  document.getElementById('uploadForm').classList.add('hidden');
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
  const adminCode = document.getElementById('registerAdminCode').value.trim();
  
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
    const payload = {
      email,
      password,
      name
    };
    
    // Add admin code if provided
    if (adminCode) {
      payload.adminCode = adminCode;
    }
    
    const response = await axios.post('/api/auth/register', payload);
    
    hideRegisterModal();
    
    const userRole = response.data.user.role;
    const roleText = userRole === 'admin' ? ' (관리자 권한)' : '';
    showNotification(`회원가입 성공${roleText}! 로그인해주세요.`, 'success');
    
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
    
    // Get detailed error message
    const errorData = error.response?.data;
    let errorMessage = '죄송합니다. 질문을 처리하는 중 오류가 발생했습니다.';
    
    if (errorData) {
      if (errorData.code === 'NO_API_KEY') {
        errorMessage = '⚠️ OpenAI API 키가 설정되지 않았습니다.\n\n관리자에게 문의하거나, 관리자라면 "관리자 페이지 > API 설정"에서 OpenAI API 키를 설정해주세요.';
      } else if (errorData.code === 'INVALID_API_KEY') {
        errorMessage = '⚠️ OpenAI API 키가 유효하지 않습니다.\n\n관리자는 "관리자 페이지 > API 설정"에서 올바른 API 키를 다시 설정해주세요.';
      } else if (errorData.code === 'QUOTA_EXCEEDED') {
        errorMessage = '⚠️ OpenAI API 사용 한도를 초과했습니다.\n\nOpenAI 계정에 크레딧을 충전하거나 잠시 후 다시 시도해주세요.';
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    }
    
    addMessage('ai', errorMessage, [], 0);
    showNotification(errorData?.error || '질문 처리 실패', 'error');
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
    const response = await axios.get('/api/documents/stats', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const stats = response.data;
    document.getElementById('docCount').textContent = stats.totalDocuments || '0';
    document.getElementById('queryCount').textContent = stats.totalQuestions || '0';
    document.getElementById('avgResponse').textContent = stats.averageResponseTime ? `${stats.averageResponseTime}ms` : '-';
  } catch (error) {
    console.error('Failed to load stats:', error);
    document.getElementById('docCount').textContent = '-';
    document.getElementById('queryCount').textContent = '-';
    document.getElementById('avgResponse').textContent = '-';
  }
}

async function loadDocumentsList() {
  if (!authToken) return;
  
  const documentsList = document.getElementById('documentsList');
  
  try {
    documentsList.innerHTML = '<div class="text-center text-gray-500 text-sm py-4"><i class="fas fa-spinner fa-spin mr-2"></i>로딩 중...</div>';
    
    const response = await axios.get('/api/documents', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const documents = response.data.documents || [];
    
    if (documents.length === 0) {
      documentsList.innerHTML = '<div class="text-center text-gray-400 text-sm py-4">업로드된 문서가 없습니다</div>';
      return;
    }
    
    // Sort by created_at (newest first)
    documents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    documentsList.innerHTML = documents.map(doc => {
      // Status badge
      let statusBadge = '';
      let statusColor = '';
      let statusIcon = '';
      
      if (doc.status === 'indexed') {
        statusBadge = '완료';
        statusColor = 'bg-green-100 text-green-800';
        statusIcon = 'fa-check-circle';
      } else if (doc.status === 'processing') {
        statusBadge = '처리중';
        statusColor = 'bg-yellow-100 text-yellow-800';
        statusIcon = 'fa-spinner fa-spin';
      } else if (doc.status === 'failed') {
        statusBadge = '실패';
        statusColor = 'bg-red-100 text-red-800';
        statusIcon = 'fa-exclamation-circle';
      }
      
      // File type icon
      let fileIcon = 'fa-file';
      if (doc.file_type.includes('pdf')) {
        fileIcon = 'fa-file-pdf text-red-600';
      } else if (doc.file_type.includes('word') || doc.file_type.includes('document')) {
        fileIcon = 'fa-file-word text-blue-600';
      } else if (doc.file_type.includes('presentation') || doc.file_type.includes('powerpoint')) {
        fileIcon = 'fa-file-powerpoint text-orange-600';
      } else if (doc.file_type.includes('text') || doc.file_type.includes('markdown')) {
        fileIcon = 'fa-file-alt text-gray-600';
      }
      
      // Format date
      const date = new Date(doc.created_at);
      const formattedDate = date.toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // File size
      const fileSize = doc.file_size < 1024 * 1024 
        ? `${Math.round(doc.file_size / 1024)}KB`
        : `${(doc.file_size / (1024 * 1024)).toFixed(1)}MB`;
      
      return `
        <div class="bg-gray-50 hover:bg-gray-100 rounded-lg p-3 transition-colors border border-gray-200">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <i class="fas ${fileIcon}"></i>
                <span class="text-sm font-medium text-gray-900 truncate" title="${escapeHtml(doc.title)}">
                  ${escapeHtml(doc.title)}
                </span>
              </div>
              <div class="flex items-center gap-2 text-xs text-gray-500">
                <span>${escapeHtml(doc.filename)}</span>
                <span>•</span>
                <span>${fileSize}</span>
                <span>•</span>
                <span>${formattedDate}</span>
              </div>
            </div>
            <span class="ml-2 px-2 py-1 rounded text-xs font-medium ${statusColor} whitespace-nowrap">
              <i class="fas ${statusIcon} mr-1"></i>${statusBadge}
            </span>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Failed to load documents:', error);
    documentsList.innerHTML = '<div class="text-center text-red-500 text-sm py-4">문서 목록을 불러올 수 없습니다</div>';
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
  if (!authToken) {
    showNotification('로그인이 필요합니다', 'error');
    return;
  }
  
  // Redirect to documents management page
  window.location.href = '/documents';
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

// Document Upload Functions
async function handleDocumentUpload() {
  const fileInput = document.getElementById('documentFile');
  const titleInput = document.getElementById('documentTitle');
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadProgress = document.getElementById('uploadProgress');
  const uploadStatus = document.getElementById('uploadStatus');
  const uploadProgressBar = document.getElementById('uploadProgressBar');
  const uploadResult = document.getElementById('uploadResult');
  
  // Validate file selection
  if (!fileInput.files || fileInput.files.length === 0) {
    showNotification('파일을 선택해주세요', 'error');
    return;
  }
  
  const files = Array.from(fileInput.files);
  const customTitle = titleInput.value.trim();
  
  // Validate file types and sizes
  const validExtensions = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt', '.md', '.markdown'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  for (const file of files) {
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
      showNotification(`지원되지 않는 파일 형식: ${file.name}\n\n지원 형식: PDF, DOCX, PPTX, TXT, MD`, 'error');
      return;
    }
    if (file.size > maxSize) {
      showNotification(`파일 크기 초과: ${file.name}\n(최대 10MB)`, 'error');
      return;
    }
  }
  
  try {
    // Show progress
    uploadBtn.disabled = true;
    uploadProgress.classList.remove('hidden');
    uploadResult.classList.add('hidden');
    uploadStatus.textContent = `${files.length}개 파일 업로드 중...`;
    uploadProgressBar.style.width = '0%';
    
    const results = [];
    const errors = [];
    
    // Upload files one by one
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const title = customTitle || file.name;
      
      try {
        uploadStatus.textContent = `업로드 중... (${i + 1}/${files.length}): ${file.name}`;
        const progress = Math.round(((i) / files.length) * 100);
        uploadProgressBar.style.width = progress + '%';
        
        // Prepare form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        
        // Upload file
        const response = await axios.post('/api/documents/upload', formData, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        
        results.push({ filename: file.name, success: true });
      } catch (error) {
        console.error(`Upload error for ${file.name}:`, error);
        errors.push({ 
          filename: file.name, 
          error: error.response?.data?.error || error.message 
        });
      }
    }
    
    uploadProgressBar.style.width = '100%';
    uploadStatus.textContent = '완료!';
    
    // Show results
    let resultHtml = '';
    if (results.length > 0) {
      resultHtml += `<div class="text-green-800"><i class="fas fa-check-circle mr-2"></i><strong>성공: ${results.length}개</strong></div>`;
      results.forEach(r => {
        resultHtml += `<div class="text-xs ml-6 mt-1">✓ ${escapeHtml(r.filename)}</div>`;
      });
    }
    if (errors.length > 0) {
      resultHtml += `<div class="text-red-800 mt-2"><i class="fas fa-exclamation-circle mr-2"></i><strong>실패: ${errors.length}개</strong></div>`;
      errors.forEach(e => {
        resultHtml += `<div class="text-xs ml-6 mt-1">✗ ${escapeHtml(e.filename)}: ${escapeHtml(e.error)}</div>`;
      });
    }
    
    uploadResult.className = results.length > 0 ? 
      'mt-3 p-3 rounded-lg text-sm bg-green-50 border border-green-200' :
      'mt-3 p-3 rounded-lg text-sm bg-red-50 border border-red-200';
    uploadResult.innerHTML = resultHtml;
    uploadResult.classList.remove('hidden');
    
    // Reset form
    fileInput.value = '';
    titleInput.value = '';
    
    // Reload stats and documents list
    setTimeout(() => {
      loadStats();
      loadDocumentsList();
      uploadProgress.classList.add('hidden');
      uploadProgressBar.style.width = '0%';
    }, 3000);
    
    if (results.length > 0) {
      showNotification(`${results.length}개 문서가 성공적으로 업로드되었습니다!`, 'success');
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    console.error('Error response:', error.response);
    console.error('Error data:', error.response?.data);
    
    uploadProgress.classList.add('hidden');
    uploadProgressBar.style.width = '0%';
    
    let errorMessage = '문서 업로드 중 오류가 발생했습니다.';
    let detailsHtml = '';
    let debugInfoHtml = '';
    
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
      
      // Show stack trace if available
      if (error.response.data.details) {
        detailsHtml = `<div class="mt-2 p-2 bg-red-100 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">${escapeHtml(error.response.data.details)}</div>`;
      }
    } else if (error.response?.status === 401) {
      errorMessage = '인증이 만료되었습니다. 다시 로그인해주세요.';
    } else if (error.response?.status === 413) {
      errorMessage = '파일 크기가 너무 큽니다.';
    } else if (error.message) {
      errorMessage += ' ' + error.message;
    }
    
    // Add debug information for mobile users
    debugInfoHtml = `
      <div class="mt-2 p-2 bg-gray-100 rounded text-xs">
        <strong>디버그 정보:</strong><br>
        - HTTP 상태: ${error.response?.status || 'N/A'}<br>
        - 에러 타입: ${error.name || 'Unknown'}<br>
        - 에러 메시지: ${escapeHtml(error.message || 'No message')}<br>
        ${error.response?.data ? `- 서버 응답: ${escapeHtml(JSON.stringify(error.response.data).substring(0, 200))}` : ''}
      </div>
    `;
    
    uploadResult.className = 'mt-3 p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200';
    uploadResult.innerHTML = `
      <i class="fas fa-exclamation-circle mr-2"></i>
      <strong>업로드 실패</strong><br>
      <span class="text-xs">${escapeHtml(errorMessage)}</span>
      ${detailsHtml}
      ${debugInfoHtml}
    `;
    uploadResult.classList.remove('hidden');
    
    showNotification(errorMessage, 'error');
  } finally {
    uploadBtn.disabled = false;
  }
}
