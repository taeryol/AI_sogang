// Admin Panel Application

let authToken = null;
let currentUser = null;
let currentTab = 'dashboard';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  // Load auth from localStorage
  authToken = localStorage.getItem('authToken');
  const userStr = localStorage.getItem('currentUser');
  
  if (userStr) {
    try {
      currentUser = JSON.parse(userStr);
    } catch (e) {
      console.error('Failed to parse user:', e);
    }
  }
  
  // Check auth
  if (!authToken || !currentUser || currentUser.role !== 'admin') {
    window.location.href = '/';
    return;
  }
  
  renderApp();
  loadDashboard();
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
            <a href="/" class="text-blue-600 hover:text-blue-800"><i class="fas fa-home mr-2"></i>메인으로</a>
            <button onclick="handleLogout()" class="text-red-600 hover:text-red-800"><i class="fas fa-sign-out-alt mr-2"></i>로그아웃</button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Tabs -->
      <div class="border-b border-gray-200 mb-6">
        <nav class="-mb-px flex space-x-8">
          <button onclick="switchTab('dashboard')" id="tab-dashboard" class="tab-button whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm">
            <i class="fas fa-chart-line mr-2"></i>대시보드
          </button>
          <button onclick="switchTab('users')" id="tab-users" class="tab-button whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm">
            <i class="fas fa-users mr-2"></i>사용자 관리
          </button>
          <button onclick="switchTab('api-settings')" id="tab-api-settings" class="tab-button whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm">
            <i class="fas fa-plug mr-2"></i>API 설정
          </button>
          <button onclick="switchTab('audit')" id="tab-audit" class="tab-button whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm">
            <i class="fas fa-history mr-2"></i>감사 로그
          </button>
        </nav>
      </div>

      <!-- Content Area -->
      <div id="content-area"></div>
    </div>
  `;
  
  updateTabStyles();
}

function switchTab(tab) {
  currentTab = tab;
  updateTabStyles();
  
  switch(tab) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'users':
      loadUsers();
      break;
    case 'api-settings':
      loadAPISettings();
      break;
    case 'audit':
      loadAuditLog();
      break;
  }
}

function updateTabStyles() {
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('border-blue-500', 'text-blue-600');
    btn.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
  });
  
  const activeTab = document.getElementById(`tab-${currentTab}`);
  if (activeTab) {
    activeTab.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    activeTab.classList.add('border-blue-500', 'text-blue-600');
  }
}

async function loadDashboard() {
  const content = document.getElementById('content-area');
  content.innerHTML = '<div class="text-center py-12"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i></div>';
  
  try {
    const response = await axios.get('/api/admin/stats', {
      headers: { 'Authorization': \`Bearer \${authToken}\` }
    });
    
    const { stats, recent_queries } = response.data;
    
    content.innerHTML = `
      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">총 사용자</p>
              <p class="text-3xl font-bold text-gray-900">${stats.total_users}</p>
            </div>
            <i class="fas fa-users text-4xl text-blue-500"></i>
          </div>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">총 문서</p>
              <p class="text-3xl font-bold text-gray-900">${stats.total_documents}</p>
            </div>
            <i class="fas fa-file-alt text-4xl text-green-500"></i>
          </div>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">총 질의</p>
              <p class="text-3xl font-bold text-gray-900">${stats.total_queries}</p>
            </div>
            <i class="fas fa-comments text-4xl text-purple-500"></i>
          </div>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-600">평균 응답</p>
              <p class="text-3xl font-bold text-gray-900">${stats.avg_response_time}ms</p>
            </div>
            <i class="fas fa-clock text-4xl text-yellow-500"></i>
          </div>
        </div>
      </div>
      
      <!-- Recent Queries -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-bold mb-4">최근 질의 (최근 10개)</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용자</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">질문</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">응답시간</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              ${recent_queries.map(q => `
                <tr>
                  <td class="px-4 py-3 text-sm">${q.user_name}</td>
                  <td class="px-4 py-3 text-sm max-w-md truncate">${q.question}</td>
                  <td class="px-4 py-3 text-sm">
                    <span class="px-2 py-1 text-xs rounded ${q.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                      ${q.status}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm">${q.response_time_ms}ms</td>
                  <td class="px-4 py-3 text-sm text-gray-500">${new Date(q.created_at).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    content.innerHTML = '<div class="text-center text-red-600 py-12">대시보드 로드 실패</div>';
  }
}

async function loadUsers() {
  const content = document.getElementById('content-area');
  content.innerHTML = '<div class="text-center py-12"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i></div>';
  
  try {
    const response = await axios.get('/api/admin/users', {
      headers: { 'Authorization': \`Bearer \${authToken}\` }
    });
    
    const users = response.data.users;
    
    content.innerHTML = `
      <div class="bg-white rounded-lg shadow">
        <div class="p-6 border-b flex justify-between items-center">
          <h2 class="text-xl font-bold">사용자 관리</h2>
          <button onclick="generateAdminCode()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
            <i class="fas fa-key mr-2"></i>관리자 코드 생성
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">작업</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              ${users.map(user => `
                <tr>
                  <td class="px-6 py-4 text-sm">${user.id}</td>
                  <td class="px-6 py-4 text-sm font-medium">${user.name}</td>
                  <td class="px-6 py-4 text-sm">${user.email}</td>
                  <td class="px-6 py-4 text-sm">
                    <span class="px-2 py-1 text-xs rounded ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}">
                      ${user.role}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-500">${new Date(user.created_at).toLocaleDateString()}</td>
                  <td class="px-6 py-4 text-sm text-right space-x-2">
                    ${user.id !== currentUser.id ? `
                      <button onclick="toggleUserRole(${user.id}, '${user.role}')" class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-user-tag"></i>
                      </button>
                      <button onclick="deleteUser(${user.id}, '${user.email}')" class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                      </button>
                    ` : '<span class="text-gray-400">(본인)</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load users:', error);
    content.innerHTML = '<div class="text-center text-red-600 py-12">사용자 목록 로드 실패</div>';
  }
}

async function loadAPISettings() {
  const content = document.getElementById('content-area');
  content.innerHTML = '<div class="text-center py-12"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i></div>';
  
  try {
    const response = await axios.get('/api/admin/settings', {
      headers: { 'Authorization': \`Bearer \${authToken}\` }
    });
    
    const settings = response.data.settings;
    
    content.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- OpenAI Settings -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-bold mb-4 flex items-center">
            <i class="fas fa-robot text-green-600 mr-2"></i>OpenAI API 설정
          </h3>
          <form onsubmit="saveAPISetting(event, 'openai_api_key')">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">API Key</label>
              <input type="password" id="openai_api_key" class="w-full px-4 py-2 border rounded-lg" placeholder="sk-..." required>
              <p class="text-xs text-gray-500 mt-1">https://platform.openai.com/api-keys 에서 발급</p>
            </div>
            <button type="submit" class="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
              <i class="fas fa-save mr-2"></i>저장
            </button>
          </form>
        </div>

        <!-- Vector DB Settings -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-bold mb-4 flex items-center">
            <i class="fas fa-database text-purple-600 mr-2"></i>Vector DB 설정
          </h3>
          <form onsubmit="saveVectorDBSettings(event)">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">DB 유형</label>
              <select id="vector_db_type" class="w-full px-4 py-2 border rounded-lg">
                <option value="simple">Simple (In-Memory)</option>
                <option value="pinecone">Pinecone</option>
              </select>
            </div>
            <div id="pinecone-settings" class="hidden">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Pinecone API Key</label>
                <input type="password" id="pinecone_api_key" class="w-full px-4 py-2 border rounded-lg" placeholder="pcsk_...">
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Environment</label>
                <input type="text" id="pinecone_environment" class="w-full px-4 py-2 border rounded-lg" placeholder="us-west1-gcp">
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Index Name</label>
                <input type="text" id="pinecone_index" class="w-full px-4 py-2 border rounded-lg" placeholder="kms-embeddings">
              </div>
            </div>
            <button type="submit" class="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">
              <i class="fas fa-save mr-2"></i>저장
            </button>
          </form>
        </div>
      </div>

      <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 class="font-bold text-blue-900 mb-2"><i class="fas fa-info-circle mr-2"></i>API 설정 안내</h4>
        <ul class="text-sm text-blue-800 space-y-1">
          <li>• OpenAI API Key는 임베딩 생성 및 답변 생성에 필수입니다</li>
          <li>• Vector DB는 문서 검색 성능에 영향을 줍니다</li>
          <li>• Simple DB는 개발용이며, 프로덕션에서는 Pinecone 권장</li>
          <li>• 설정 변경 후 서버 재시작이 필요할 수 있습니다</li>
        </ul>
      </div>
    `;
    
    // Toggle Pinecone settings visibility
    document.getElementById('vector_db_type').addEventListener('change', (e) => {
      const pineconeSettings = document.getElementById('pinecone-settings');
      if (e.target.value === 'pinecone') {
        pineconeSettings.classList.remove('hidden');
      } else {
        pineconeSettings.classList.add('hidden');
      }
    });
  } catch (error) {
    console.error('Failed to load API settings:', error);
    content.innerHTML = '<div class="text-center text-red-600 py-12">API 설정 로드 실패</div>';
  }
}

async function loadAuditLog() {
  const content = document.getElementById('content-area');
  content.innerHTML = '<div class="text-center py-12"><i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i></div>';
  
  try {
    const response = await axios.get('/api/admin/audit-log', {
      headers: { 'Authorization': \`Bearer \${authToken}\` }
    });
    
    const logs = response.data.logs;
    
    content.innerHTML = `
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-bold mb-4">사용자 감사 로그</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용자</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">작업</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상세</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수행자</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              ${logs.length > 0 ? logs.map(log => `
                <tr>
                  <td class="px-4 py-3 text-sm text-gray-500">${new Date(log.created_at).toLocaleString()}</td>
                  <td class="px-4 py-3 text-sm">${log.user_name} (${log.user_email})</td>
                  <td class="px-4 py-3 text-sm">
                    <span class="px-2 py-1 text-xs rounded bg-gray-100">${log.action}</span>
                  </td>
                  <td class="px-4 py-3 text-sm">${log.details || '-'}</td>
                  <td class="px-4 py-3 text-sm">${log.performed_by_name}</td>
                </tr>
              `).join('') : '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">감사 로그가 없습니다</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load audit log:', error);
    content.innerHTML = '<div class="text-center text-red-600 py-12">감사 로그 로드 실패</div>';
  }
}

async function toggleUserRole(userId, currentRole) {
  const newRole = currentRole === 'admin' ? 'user' : 'admin';
  
  if (!confirm(\`이 사용자의 역할을 \${newRole}(으)로 변경하시겠습니까?\`)) {
    return;
  }
  
  try {
    await axios.put(\`/api/admin/users/\${userId}/role\`, 
      { role: newRole },
      { headers: { 'Authorization': \`Bearer \${authToken}\` }}
    );
    
    showNotification('역할이 변경되었습니다', 'success');
    loadUsers();
  } catch (error) {
    console.error('Failed to change role:', error);
    showNotification('역할 변경 실패: ' + (error.response?.data?.error || '알 수 없는 오류'), 'error');
  }
}

async function deleteUser(userId, email) {
  if (!confirm(\`정말로 "\${email}" 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.\`)) {
    return;
  }
  
  try {
    await axios.delete(\`/api/admin/users/\${userId}\`, {
      headers: { 'Authorization': \`Bearer \${authToken}\` }
    });
    
    showNotification('사용자가 삭제되었습니다', 'success');
    loadUsers();
  } catch (error) {
    console.error('Failed to delete user:', error);
    showNotification('사용자 삭제 실패: ' + (error.response?.data?.error || '알 수 없는 오류'), 'error');
  }
}

async function generateAdminCode() {
  try {
    const response = await axios.post('/api/admin/generate-code', {}, {
      headers: { 'Authorization': \`Bearer \${authToken}\` }
    });
    
    const code = response.data.code;
    
    const message = \`새로운 관리자 코드가 생성되었습니다:\\n\\n\${code}\\n\\n이 코드를 복사하여 관리자로 등록할 사용자에게 전달하세요.\`;
    alert(message);
    
    // Copy to clipboard
    navigator.clipboard.writeText(code);
    showNotification('코드가 클립보드에 복사되었습니다', 'success');
  } catch (error) {
    console.error('Failed to generate code:', error);
    showNotification('코드 생성 실패', 'error');
  }
}

async function saveAPISetting(event, key) {
  event.preventDefault();
  
  const value = document.getElementById(key).value.trim();
  
  if (!value) {
    showNotification('값을 입력해주세요', 'error');
    return;
  }
  
  try {
    await axios.put(\`/api/admin/settings/\${key}\`, 
      { value },
      { headers: { 'Authorization': \`Bearer \${authToken}\` }}
    );
    
    showNotification('설정이 저장되었습니다', 'success');
    document.getElementById(key).value = '';
  } catch (error) {
    console.error('Failed to save setting:', error);
    showNotification('설정 저장 실패', 'error');
  }
}

async function saveVectorDBSettings(event) {
  event.preventDefault();
  
  const dbType = document.getElementById('vector_db_type').value;
  
  try {
    await axios.put('/api/admin/settings/vector_db_type', 
      { value: dbType },
      { headers: { 'Authorization': \`Bearer \${authToken}\` }}
    );
    
    if (dbType === 'pinecone') {
      const apiKey = document.getElementById('pinecone_api_key').value.trim();
      const environment = document.getElementById('pinecone_environment').value.trim();
      const index = document.getElementById('pinecone_index').value.trim();
      
      if (apiKey) {
        await axios.put('/api/admin/settings/pinecone_api_key', 
          { value: apiKey },
          { headers: { 'Authorization': \`Bearer \${authToken}\` }}
        );
      }
      
      if (environment) {
        await axios.put('/api/admin/settings/pinecone_environment', 
          { value: environment },
          { headers: { 'Authorization': \`Bearer \${authToken}\` }}
        );
      }
      
      if (index) {
        await axios.put('/api/admin/settings/pinecone_index', 
          { value: index },
          { headers: { 'Authorization': \`Bearer \${authToken}\` }}
        );
      }
    }
    
    showNotification('Vector DB 설정이 저장되었습니다', 'success');
  } catch (error) {
    console.error('Failed to save vector DB settings:', error);
    showNotification('설정 저장 실패', 'error');
  }
}

function handleLogout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  window.location.href = '/';
}

function showNotification(message, type = 'info') {
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  };
  
  const notification = document.createElement('div');
  notification.className = \`fixed top-4 right-4 \${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-opacity\`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
