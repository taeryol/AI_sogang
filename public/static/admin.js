// Admin Panel Application - Complete Management System

let authToken = null;
let currentUser = null;
let currentTab = 'dashboard';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Admin] Initializing admin panel...');
  initializeApp();
});

function initializeApp() {
  try {
    // Load auth from localStorage
    authToken = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('currentUser');
    
    console.log('[Admin] Auth token:', authToken ? 'Found' : 'Not found');
    console.log('[Admin] User data:', userStr ? 'Found' : 'Not found');
    
    if (userStr) {
      try {
        currentUser = JSON.parse(userStr);
        console.log('[Admin] Current user:', currentUser);
      } catch (e) {
        console.error('[Admin] Failed to parse user:', e);
        showError('사용자 정보 파싱 실패');
        redirectToHome();
        return;
      }
    }
    
    // Check auth
    if (!authToken || !currentUser) {
      console.warn('[Admin] No authentication found, redirecting to home');
      alert('로그인이 필요합니다.');
      redirectToHome();
      return;
    }
    
    if (currentUser.role !== 'admin') {
      console.warn('[Admin] User is not admin:', currentUser.role);
      alert('관리자 권한이 필요합니다.');
      redirectToHome();
      return;
    }
    
    console.log('[Admin] Auth check passed, rendering app');
    renderApp();
    loadDashboard();
  } catch (error) {
    console.error('[Admin] Initialization error:', error);
    showError('초기화 중 오류가 발생했습니다: ' + error.message);
  }
}

function redirectToHome() {
  setTimeout(() => {
    window.location.href = '/';
  }, 1500);
}

function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <i class="fas fa-shield-alt text-purple-600 text-2xl mr-3"></i>
            <h1 class="text-xl font-bold text-gray-900">관리자 페이지</h1>
          </div>
          <div class="flex items-center space-x-4">
            <span class="text-gray-700"><i class="fas fa-user-shield mr-2"></i>${currentUser.name}</span>
            <a href="/" class="text-blue-600 hover:text-blue-800 font-medium"><i class="fas fa-home mr-2"></i>메인으로</a>
            <button onclick="handleLogout()" class="text-red-600 hover:text-red-800 font-medium"><i class="fas fa-sign-out-alt mr-2"></i>로그아웃</button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Tabs -->
      <div class="bg-white rounded-lg shadow mb-6">
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            <button onclick="switchTab('dashboard')" id="tab-dashboard" class="tab-button border-purple-500 text-purple-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
              <i class="fas fa-chart-line mr-2"></i>대시보드
            </button>
            <button onclick="switchTab('users')" id="tab-users" class="tab-button border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
              <i class="fas fa-users mr-2"></i>사용자 관리
            </button>
            <button onclick="switchTab('documents')" id="tab-documents" class="tab-button border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
              <i class="fas fa-file-alt mr-2"></i>문서 관리
            </button>
            <button onclick="switchTab('queries')" id="tab-queries" class="tab-button border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
              <i class="fas fa-comments mr-2"></i>질의 기록
            </button>
            <button onclick="switchTab('api')" id="tab-api" class="tab-button border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
              <i class="fas fa-cog mr-2"></i>API 설정
            </button>
            <button onclick="switchTab('audit')" id="tab-audit" class="tab-button border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
              <i class="fas fa-history mr-2"></i>감사 로그
            </button>
          </nav>
        </div>
      </div>

      <!-- Tab Content -->
      <div id="tabContent" class="bg-white rounded-lg shadow p-6">
        <!-- Content will be loaded here -->
        <div class="flex justify-center items-center py-12">
          <div class="text-center">
            <i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
            <p class="text-gray-500">로딩 중...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Notification Toast -->
    <div id="notification" class="hidden fixed top-4 right-4 max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5">
      <div class="p-4">
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <i id="notificationIcon" class="fas fa-check-circle text-green-500 text-xl"></i>
          </div>
          <div class="ml-3 flex-1">
            <p id="notificationMessage" class="text-sm font-medium text-gray-900"></p>
          </div>
          <div class="ml-4 flex-shrink-0 flex">
            <button onclick="hideNotification()" class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function switchTab(tab) {
  console.log('[Admin] Switching to tab:', tab);
  currentTab = tab;
  
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('border-purple-500', 'text-purple-600');
    btn.classList.add('border-transparent', 'text-gray-500');
  });
  document.getElementById(`tab-${tab}`).classList.remove('border-transparent', 'text-gray-500');
  document.getElementById(`tab-${tab}`).classList.add('border-purple-500', 'text-purple-600');
  
  // Load content
  switch(tab) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'users':
      loadUsers();
      break;
    case 'documents':
      loadDocuments();
      break;
    case 'queries':
      loadQueries();
      break;
    case 'api':
      loadAPISettings();
      break;
    case 'audit':
      loadAuditLog();
      break;
  }
}

// ===== DASHBOARD =====
async function loadDashboard() {
  console.log('[Admin] Loading dashboard...');
  const content = document.getElementById('tabContent');
  content.innerHTML = `
    <div>
      <h2 class="text-2xl font-bold text-gray-900 mb-6">시스템 대시보드</h2>
      
      <!-- Loading State -->
      <div class="flex justify-center items-center py-12">
        <i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i>
      </div>
    </div>
  `;
  
  try {
    const response = await axios.get('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    console.log('[Admin] Stats loaded:', response.data);
    const { stats, recent_queries } = response.data;
    
    content.innerHTML = `
      <div>
        <h2 class="text-2xl font-bold text-gray-900 mb-6">시스템 대시보드</h2>
        
        <!-- Stats Grid -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-blue-100 text-sm font-medium">전체 사용자</p>
                <p class="text-3xl font-bold mt-2">${stats.total_users || 0}</p>
              </div>
              <i class="fas fa-users text-4xl text-blue-200"></i>
            </div>
          </div>
          
          <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-green-100 text-sm font-medium">등록된 문서</p>
                <p class="text-3xl font-bold mt-2">${stats.total_documents || 0}</p>
              </div>
              <i class="fas fa-file-alt text-4xl text-green-200"></i>
            </div>
          </div>
          
          <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-purple-100 text-sm font-medium">총 질의 수</p>
                <p class="text-3xl font-bold mt-2">${stats.total_queries || 0}</p>
              </div>
              <i class="fas fa-comments text-4xl text-purple-200"></i>
            </div>
          </div>
          
          <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow p-6 text-white">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-orange-100 text-sm font-medium">평균 응답시간</p>
                <p class="text-3xl font-bold mt-2">${stats.avg_response_time || 0}ms</p>
              </div>
              <i class="fas fa-tachometer-alt text-4xl text-orange-200"></i>
            </div>
          </div>
        </div>
        
        <!-- Recent Queries -->
        <div class="bg-gray-50 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">최근 질의 내역</h3>
          ${recent_queries.length > 0 ? `
            <div class="space-y-4">
              ${recent_queries.map(q => `
                <div class="bg-white rounded-lg p-4 border border-gray-200">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-900">${escapeHtml(q.question)}</p>
                      <p class="text-xs text-gray-500 mt-1">
                        <i class="fas fa-user mr-1"></i>사용자 ID: ${q.user_id} | 
                        <i class="fas fa-clock mr-1"></i>${formatDate(q.created_at)}
                      </p>
                    </div>
                    <span class="px-2 py-1 text-xs font-semibold rounded ${q.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                      ${q.status === 'success' ? '성공' : '실패'}
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="text-center py-8 text-gray-500">
              <i class="fas fa-inbox text-4xl mb-2"></i>
              <p>최근 질의 내역이 없습니다.</p>
            </div>
          `}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('[Admin] Failed to load dashboard:', error);
    content.innerHTML = `
      <div class="text-center py-12">
        <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
        <p class="text-gray-700 mb-2">대시보드 로드 실패</p>
        <p class="text-sm text-gray-500">${error.response?.data?.error || error.message}</p>
        <button onclick="loadDashboard()" class="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
          다시 시도
        </button>
      </div>
    `;
  }
}

// ===== USER MANAGEMENT =====
async function loadUsers() {
  console.log('[Admin] Loading users...');
  const content = document.getElementById('tabContent');
  content.innerHTML = `
    <div>
      <h2 class="text-2xl font-bold text-gray-900 mb-6">사용자 관리</h2>
      <div class="flex justify-center items-center py-12">
        <i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i>
      </div>
    </div>
  `;
  
  try {
    const response = await axios.get('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    console.log('[Admin] Users loaded:', response.data);
    const users = response.data.users;
    
    content.innerHTML = `
      <div>
        <h2 class="text-2xl font-bold text-gray-900 mb-6">사용자 관리</h2>
        
        <div class="bg-white rounded-lg border border-gray-200">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${users.map(user => `
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${user.id}</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <i class="fas fa-user-circle text-2xl text-gray-400 mr-3"></i>
                      <div class="text-sm font-medium text-gray-900">${escapeHtml(user.name)}</div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(user.email)}</td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}">
                      ${user.role === 'admin' ? '관리자' : '사용자'}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(user.created_at)}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    ${user.id !== currentUser.id ? `
                      <button onclick="toggleUserRole(${user.id}, '${user.role}')" class="text-blue-600 hover:text-blue-900 mr-3">
                        <i class="fas fa-exchange-alt mr-1"></i>역할 변경
                      </button>
                      <button onclick="deleteUser(${user.id}, '${escapeHtml(user.name)}')" class="text-red-600 hover:text-red-900">
                        <i class="fas fa-trash mr-1"></i>삭제
                      </button>
                    ` : `
                      <span class="text-gray-400">본인</span>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <i class="fas fa-info-circle text-blue-400"></i>
            </div>
            <div class="ml-3">
              <p class="text-sm text-blue-700">
                새 관리자를 추가하려면 관리자 코드 <strong>ADMIN-SETUP-2025</strong>를 사용하여 회원가입하세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('[Admin] Failed to load users:', error);
    showError('사용자 목록 로드 실패: ' + (error.response?.data?.error || error.message));
  }
}

async function toggleUserRole(userId, currentRole) {
  const newRole = currentRole === 'admin' ? 'user' : 'admin';
  const confirmMsg = `이 사용자를 ${newRole === 'admin' ? '관리자' : '일반 사용자'}로 변경하시겠습니까?`;
  
  if (!confirm(confirmMsg)) return;
  
  try {
    await axios.put(`/api/admin/users/${userId}/role`, 
      { role: newRole },
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    showNotification('역할이 변경되었습니다.', 'success');
    loadUsers();
  } catch (error) {
    console.error('[Admin] Failed to change role:', error);
    showError('역할 변경 실패: ' + (error.response?.data?.error || error.message));
  }
}

async function deleteUser(userId, userName) {
  if (!confirm(`사용자 "${userName}"를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
  
  try {
    await axios.delete(`/api/admin/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    showNotification('사용자가 삭제되었습니다.', 'success');
    loadUsers();
  } catch (error) {
    console.error('[Admin] Failed to delete user:', error);
    showError('사용자 삭제 실패: ' + (error.response?.data?.error || error.message));
  }
}

// ===== DOCUMENT MANAGEMENT =====
async function loadDocuments() {
  console.log('[Admin] Loading documents...');
  const content = document.getElementById('tabContent');
  content.innerHTML = `
    <div>
      <h2 class="text-2xl font-bold text-gray-900 mb-6">문서 관리</h2>
      <div class="flex justify-center items-center py-12">
        <i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i>
      </div>
    </div>
  `;
  
  try {
    const response = await axios.get('/api/documents', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    console.log('[Admin] Documents loaded:', response.data);
    const documents = response.data.documents || [];
    
    content.innerHTML = `
      <div>
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-900">문서 관리</h2>
          <button onclick="showUploadModal()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
            <i class="fas fa-upload mr-2"></i>문서 업로드
          </button>
        </div>
        
        ${documents.length > 0 ? `
          <div class="bg-white rounded-lg border border-gray-200">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제목</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">파일</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">크기</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">업로드일</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${documents.map(doc => `
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${doc.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(doc.title)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(doc.file_name)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatFileSize(doc.file_size)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(doc.status)}">
                        ${getStatusText(doc.status)}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(doc.created_at)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button onclick="deleteDocument(${doc.id}, '${escapeHtml(doc.title)}')" class="text-red-600 hover:text-red-900">
                        <i class="fas fa-trash mr-1"></i>삭제
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="text-center py-12 bg-gray-50 rounded-lg">
            <i class="fas fa-folder-open text-6xl text-gray-300 mb-4"></i>
            <p class="text-gray-500 mb-4">등록된 문서가 없습니다.</p>
            <button onclick="showUploadModal()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
              <i class="fas fa-upload mr-2"></i>첫 문서 업로드
            </button>
          </div>
        `}
      </div>
    `;
  } catch (error) {
    console.error('[Admin] Failed to load documents:', error);
    showError('문서 목록 로드 실패: ' + (error.response?.data?.error || error.message));
  }
}

function showUploadModal() {
  showNotification('문서 업로드 기능은 메인 페이지에서 사용할 수 있습니다. 메인 페이지로 이동하시겠습니까?', 'info');
  if (confirm('메인 페이지로 이동하시겠습니까?')) {
    window.location.href = '/';
  }
}

async function deleteDocument(docId, docTitle) {
  if (!confirm(`문서 "${docTitle}"를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
  
  try {
    await axios.delete(`/api/documents/${docId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    showNotification('문서가 삭제되었습니다.', 'success');
    loadDocuments();
  } catch (error) {
    console.error('[Admin] Failed to delete document:', error);
    showError('문서 삭제 실패: ' + (error.response?.data?.error || error.message));
  }
}

// ===== QUERY HISTORY =====
async function loadQueries() {
  console.log('[Admin] Loading queries...');
  const content = document.getElementById('tabContent');
  content.innerHTML = `
    <div>
      <h2 class="text-2xl font-bold text-gray-900 mb-6">질의 기록</h2>
      <div class="flex justify-center items-center py-12">
        <i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i>
      </div>
    </div>
  `;
  
  try {
    // Get all queries from stats endpoint for now
    const response = await axios.get('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const queries = response.data.recent_queries || [];
    
    content.innerHTML = `
      <div>
        <h2 class="text-2xl font-bold text-gray-900 mb-6">질의 기록</h2>
        
        ${queries.length > 0 ? `
          <div class="space-y-4">
            ${queries.map(q => `
              <div class="bg-white rounded-lg border border-gray-200 p-6">
                <div class="flex items-start justify-between mb-4">
                  <div class="flex-1">
                    <div class="flex items-center mb-2">
                      <span class="text-xs text-gray-500 mr-3">
                        <i class="fas fa-user mr-1"></i>사용자 ID: ${q.user_id}
                      </span>
                      <span class="text-xs text-gray-500 mr-3">
                        <i class="fas fa-clock mr-1"></i>${formatDate(q.created_at)}
                      </span>
                      ${q.response_time ? `
                        <span class="text-xs text-gray-500">
                          <i class="fas fa-tachometer-alt mr-1"></i>${q.response_time}ms
                        </span>
                      ` : ''}
                    </div>
                    <div class="mb-3">
                      <p class="text-sm font-semibold text-gray-700 mb-1">질문:</p>
                      <p class="text-sm text-gray-900">${escapeHtml(q.question)}</p>
                    </div>
                    ${q.answer ? `
                      <div>
                        <p class="text-sm font-semibold text-gray-700 mb-1">답변:</p>
                        <p class="text-sm text-gray-600">${escapeHtml(q.answer).substring(0, 200)}${q.answer.length > 200 ? '...' : ''}</p>
                      </div>
                    ` : ''}
                  </div>
                  <span class="ml-4 px-3 py-1 text-xs font-semibold rounded-full ${q.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    ${q.status === 'success' ? '성공' : '실패'}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="text-center py-12 bg-gray-50 rounded-lg">
            <i class="fas fa-comments text-6xl text-gray-300 mb-4"></i>
            <p class="text-gray-500">질의 기록이 없습니다.</p>
          </div>
        `}
      </div>
    `;
  } catch (error) {
    console.error('[Admin] Failed to load queries:', error);
    showError('질의 기록 로드 실패: ' + (error.response?.data?.error || error.message));
  }
}

// ===== API SETTINGS =====
async function loadAPISettings() {
  console.log('[Admin] Loading API settings...');
  const content = document.getElementById('tabContent');
  content.innerHTML = `
    <div>
      <h2 class="text-2xl font-bold text-gray-900 mb-6">API 설정</h2>
      <div class="flex justify-center items-center py-12">
        <i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i>
      </div>
    </div>
  `;
  
  try {
    const response = await axios.get('/api/admin/settings', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    console.log('[Admin] Settings loaded:', response.data);
    const settings = response.data.settings;
    
    // Convert array to object for easy access
    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.setting_key] = s.setting_value;
    });
    
    content.innerHTML = `
      <div>
        <h2 class="text-2xl font-bold text-gray-900 mb-6">API 설정</h2>
        
        <!-- OpenAI Settings -->
        <div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            <i class="fas fa-robot text-blue-500 mr-2"></i>OpenAI 설정
          </h3>
          <form onsubmit="saveOpenAISettings(event)" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">API Key</label>
              <input type="password" id="openai_api_key" value="${settingsMap.openai_api_key || ''}" 
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="sk-...">
              <p class="mt-1 text-xs text-gray-500">OpenAI API 키를 입력하세요. 비밀번호로 암호화되어 저장됩니다.</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">GPT 모델</label>
              <select id="openai_model" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                <option value="gpt-4" ${settingsMap.openai_model === 'gpt-4' ? 'selected' : ''}>GPT-4</option>
                <option value="gpt-4-turbo" ${settingsMap.openai_model === 'gpt-4-turbo' ? 'selected' : ''}>GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo" ${settingsMap.openai_model === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">임베딩 모델</label>
              <select id="embedding_model" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                <option value="text-embedding-3-small" ${settingsMap.embedding_model === 'text-embedding-3-small' ? 'selected' : ''}>text-embedding-3-small</option>
                <option value="text-embedding-3-large" ${settingsMap.embedding_model === 'text-embedding-3-large' ? 'selected' : ''}>text-embedding-3-large</option>
                <option value="text-embedding-ada-002" ${settingsMap.embedding_model === 'text-embedding-ada-002' ? 'selected' : ''}>text-embedding-ada-002</option>
              </select>
            </div>
            <button type="submit" class="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 font-medium">
              <i class="fas fa-save mr-2"></i>저장
            </button>
          </form>
        </div>
        
        <!-- Vector DB Settings -->
        <div class="bg-white rounded-lg border border-gray-200 p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            <i class="fas fa-database text-green-500 mr-2"></i>Vector DB 설정
          </h3>
          <form onsubmit="saveVectorDBSettings(event)" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Vector DB 타입</label>
              <select id="vector_db_type" onchange="togglePineconeSettings()" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                <option value="simple" ${settingsMap.vector_db_type === 'simple' ? 'selected' : ''}>Simple (인메모리 - 개발용)</option>
                <option value="pinecone" ${settingsMap.vector_db_type === 'pinecone' ? 'selected' : ''}>Pinecone (프로덕션)</option>
              </select>
            </div>
            <div id="pineconeSettings" class="space-y-4 ${settingsMap.vector_db_type === 'pinecone' ? '' : 'hidden'}">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Pinecone API Key</label>
                <input type="password" id="pinecone_api_key" value="${settingsMap.pinecone_api_key || ''}" 
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="pcsk_...">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Environment</label>
                <input type="text" id="pinecone_environment" value="${settingsMap.pinecone_environment || ''}" 
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="us-west1-gcp">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Index Name</label>
                <input type="text" id="pinecone_index" value="${settingsMap.pinecone_index || 'kms-embeddings'}" 
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="kms-embeddings">
              </div>
            </div>
            <button type="submit" class="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 font-medium">
              <i class="fas fa-save mr-2"></i>저장
            </button>
          </form>
        </div>
        
        <div class="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <i class="fas fa-exclamation-triangle text-yellow-400"></i>
            </div>
            <div class="ml-3">
              <p class="text-sm text-yellow-700">
                <strong>주의:</strong> API 키는 암호화되어 저장되지만, 브라우저에서는 평문으로 표시됩니다. 민감한 정보이므로 주의하여 관리하세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Initial state for Pinecone settings
    togglePineconeSettings();
  } catch (error) {
    console.error('[Admin] Failed to load settings:', error);
    showError('API 설정 로드 실패: ' + (error.response?.data?.error || error.message));
  }
}

function togglePineconeSettings() {
  const type = document.getElementById('vector_db_type').value;
  const pineconeSettings = document.getElementById('pineconeSettings');
  if (type === 'pinecone') {
    pineconeSettings.classList.remove('hidden');
  } else {
    pineconeSettings.classList.add('hidden');
  }
}

async function saveOpenAISettings(event) {
  event.preventDefault();
  
  const settings = {
    openai_api_key: document.getElementById('openai_api_key').value,
    openai_model: document.getElementById('openai_model').value,
    embedding_model: document.getElementById('embedding_model').value
  };
  
  try {
    for (const [key, value] of Object.entries(settings)) {
      await axios.put(`/api/admin/settings/${key}`, 
        { value },
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
    }
    
    showNotification('OpenAI 설정이 저장되었습니다.', 'success');
  } catch (error) {
    console.error('[Admin] Failed to save OpenAI settings:', error);
    showError('설정 저장 실패: ' + (error.response?.data?.error || error.message));
  }
}

async function saveVectorDBSettings(event) {
  event.preventDefault();
  
  const settings = {
    vector_db_type: document.getElementById('vector_db_type').value,
    pinecone_api_key: document.getElementById('pinecone_api_key').value,
    pinecone_environment: document.getElementById('pinecone_environment').value,
    pinecone_index: document.getElementById('pinecone_index').value
  };
  
  try {
    for (const [key, value] of Object.entries(settings)) {
      await axios.put(`/api/admin/settings/${key}`, 
        { value },
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
    }
    
    showNotification('Vector DB 설정이 저장되었습니다.', 'success');
  } catch (error) {
    console.error('[Admin] Failed to save Vector DB settings:', error);
    showError('설정 저장 실패: ' + (error.response?.data?.error || error.message));
  }
}

// ===== AUDIT LOG =====
async function loadAuditLog() {
  console.log('[Admin] Loading audit log...');
  const content = document.getElementById('tabContent');
  content.innerHTML = `
    <div>
      <h2 class="text-2xl font-bold text-gray-900 mb-6">감사 로그</h2>
      <div class="flex justify-center items-center py-12">
        <i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i>
      </div>
    </div>
  `;
  
  try {
    const response = await axios.get('/api/admin/audit-log', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    console.log('[Admin] Audit log loaded:', response.data);
    const logs = response.data.logs || [];
    
    content.innerHTML = `
      <div>
        <h2 class="text-2xl font-bold text-gray-900 mb-6">감사 로그</h2>
        
        ${logs.length > 0 ? `
          <div class="bg-white rounded-lg border border-gray-200">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">대상 사용자</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">세부사항</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수행자</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${logs.map(log => `
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDate(log.created_at)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        ${getActionText(log.action)}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">ID: ${log.user_id}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${escapeHtml(log.details || '-')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">ID: ${log.performed_by}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="text-center py-12 bg-gray-50 rounded-lg">
            <i class="fas fa-history text-6xl text-gray-300 mb-4"></i>
            <p class="text-gray-500">감사 로그가 없습니다.</p>
          </div>
        `}
      </div>
    `;
  } catch (error) {
    console.error('[Admin] Failed to load audit log:', error);
    showError('감사 로그 로드 실패: ' + (error.response?.data?.error || error.message));
  }
}

// ===== UTILITY FUNCTIONS =====
function handleLogout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  window.location.href = '/';
}

function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  const icon = document.getElementById('notificationIcon');
  const messageEl = document.getElementById('notificationMessage');
  
  messageEl.textContent = message;
  
  icon.className = 'fas text-xl mr-3';
  if (type === 'success') {
    icon.classList.add('fa-check-circle', 'text-green-500');
  } else if (type === 'error') {
    icon.classList.add('fa-exclamation-circle', 'text-red-500');
  } else {
    icon.classList.add('fa-info-circle', 'text-blue-500');
  }
  
  notification.classList.remove('hidden');
  
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 5000);
}

function hideNotification() {
  document.getElementById('notification').classList.add('hidden');
}

function showError(message) {
  showNotification(message, 'error');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getStatusBadgeClass(status) {
  switch(status) {
    case 'indexed': return 'bg-green-100 text-green-800';
    case 'processing': return 'bg-yellow-100 text-yellow-800';
    case 'failed': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getStatusText(status) {
  switch(status) {
    case 'indexed': return '인덱싱 완료';
    case 'processing': return '처리 중';
    case 'failed': return '실패';
    default: return status;
  }
}

function getActionText(action) {
  switch(action) {
    case 'role_change': return '역할 변경';
    case 'user_delete': return '사용자 삭제';
    case 'settings_update': return '설정 변경';
    default: return action;
  }
}
