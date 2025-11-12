// Documents Management Page

let authToken = localStorage.getItem('authToken');
let currentUser = null;
let documents = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    if (!authToken) {
        window.location.href = '/';
        return;
    }

    renderApp();
    await loadCurrentUser();
});

async function loadCurrentUser() {
    try {
        const response = await axios.get('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        currentUser = response.data.user;
        await loadDocuments();
    } catch (error) {
        console.error('Failed to load user:', error);
        localStorage.removeItem('authToken');
        window.location.href = '/';
    }
}

async function loadDocuments() {
    try {
        const response = await axios.get('/api/documents', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        documents = response.data.documents || [];
        renderDocumentsList();
    } catch (error) {
        console.error('Failed to load documents:', error);
        showMessage('문서 목록을 불러올 수 없습니다.', 'error');
    }
}

function renderApp() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <!-- Navigation -->
        <nav class="bg-white shadow-sm border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex items-center">
                        <img src="data:image/png;base64,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" alt="MindBase" class="h-10 mr-3">
                        <h1 class="text-xl font-bold text-gray-900">MindBase</h1>
                        <span class="ml-4 text-gray-500">문서 관리</span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-gray-600 hover:text-gray-900">
                            <i class="fas fa-home mr-2"></i>홈
                        </a>
                        <button onclick="logout()" class="text-red-600 hover:text-red-700">
                            <i class="fas fa-sign-out-alt mr-2"></i>로그아웃
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Page Header -->
            <div class="mb-8">
                <h2 class="text-3xl font-bold text-gray-900 mb-2">문서 관리</h2>
                <p class="text-gray-600">업로드된 문서를 관리하고 편집할 수 있습니다.</p>
            </div>

            <!-- Upload Section -->
            <div class="bg-white rounded-lg shadow-sm p-6 mb-8">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-upload text-primary-600 mr-2"></i>새 문서 업로드
                </h3>
                <div class="flex items-center space-x-4">
                    <input type="file" id="fileInput" accept=".txt,.pdf,.docx,.pptx" multiple class="hidden">
                    <button onclick="document.getElementById('fileInput').click()" class="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition">
                        <i class="fas fa-file-upload mr-2"></i>파일 선택
                    </button>
                    <button onclick="uploadDocuments()" id="uploadBtn" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                        <i class="fas fa-cloud-upload-alt mr-2"></i>업로드
                    </button>
                    <span id="selectedFiles" class="text-gray-600 text-sm"></span>
                </div>
                <div id="uploadStatus" class="mt-4 text-sm"></div>
            </div>

            <!-- Documents List -->
            <div class="bg-white rounded-lg shadow-sm p-6">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-semibold text-gray-900">
                        <i class="fas fa-file-alt text-primary-600 mr-2"></i>내 문서 (<span id="documentsCount">0</span>)
                    </h3>
                    <button onclick="loadDocuments()" class="text-primary-600 hover:text-primary-700">
                        <i class="fas fa-sync-alt mr-2"></i>새로고침
                    </button>
                </div>
                <div id="documentsList"></div>
            </div>
        </div>

        <!-- Rename Modal -->
        <div id="renameModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">문서 이름 변경</h3>
                <input type="text" id="newDocumentName" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4" placeholder="새 문서 이름">
                <div class="flex justify-end space-x-3">
                    <button onclick="closeRenameModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
                        취소
                    </button>
                    <button onclick="confirmRename()" class="px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700">
                        변경
                    </button>
                </div>
            </div>
        </div>

        <!-- Message Toast -->
        <div id="messageToast" class="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 hidden max-w-sm">
            <div class="flex items-center">
                <i id="messageIcon" class="fas fa-info-circle mr-3 text-xl"></i>
                <span id="messageText"></span>
            </div>
        </div>
    `;

    // File input change handler
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        const uploadBtn = document.getElementById('uploadBtn');
        const selectedFiles = document.getElementById('selectedFiles');
        
        if (files.length > 0) {
            uploadBtn.disabled = false;
            selectedFiles.textContent = `${files.length}개 파일 선택됨`;
        } else {
            uploadBtn.disabled = true;
            selectedFiles.textContent = '';
        }
    });
}

function renderDocumentsList() {
    const listEl = document.getElementById('documentsList');
    const countEl = document.getElementById('documentsCount');
    
    countEl.textContent = documents.length;

    if (documents.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <i class="fas fa-folder-open text-6xl mb-4"></i>
                <p>업로드된 문서가 없습니다.</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">문서명</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">파일명</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">크기</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">업로드 일시</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${documents.map(doc => `
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4">
                                <div class="flex items-center">
                                    <i class="fas ${getFileIcon(doc.file_type)} text-primary-600 mr-3"></i>
                                    <span class="text-sm font-medium text-gray-900">${escapeHtml(doc.title)}</span>
                                </div>
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-600">${escapeHtml(doc.filename)}</td>
                            <td class="px-6 py-4 text-sm text-gray-600">${formatFileSize(doc.file_size)}</td>
                            <td class="px-6 py-4">
                                <span class="px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(doc.status)}">
                                    ${getStatusText(doc.status)}
                                </span>
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-600">${formatDate(doc.created_at)}</td>
                            <td class="px-6 py-4 text-right text-sm font-medium">
                                <button onclick="renameDocument(${doc.id}, '${escapeHtml(doc.title)}')" class="text-primary-600 hover:text-primary-900 mr-3" title="이름 변경">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="deleteDocument(${doc.id}, '${escapeHtml(doc.title)}')" class="text-red-600 hover:text-red-900" title="삭제">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function uploadDocuments() {
    const fileInput = document.getElementById('fileInput');
    const uploadStatus = document.getElementById('uploadStatus');
    const files = Array.from(fileInput.files);

    if (files.length === 0) {
        showMessage('파일을 선택해주세요.', 'error');
        return;
    }

    uploadStatus.innerHTML = '<div class="text-primary-600"><i class="fas fa-spinner fa-spin mr-2"></i>업로드 중...</div>';

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        uploadStatus.innerHTML = `<div class="text-primary-600"><i class="fas fa-spinner fa-spin mr-2"></i>업로드 중... (${i + 1}/${files.length}): ${file.name}</div>`;

        const formData = new FormData();
        formData.append('file', file);

        try {
            await axios.post('/api/documents/upload', formData, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            successCount++;
        } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            failCount++;
        }
    }

    if (successCount > 0) {
        showMessage(`${successCount}개 파일 업로드 완료${failCount > 0 ? ` (${failCount}개 실패)` : ''}`, 'success');
        fileInput.value = '';
        document.getElementById('selectedFiles').textContent = '';
        document.getElementById('uploadBtn').disabled = true;
        uploadStatus.innerHTML = '';
        await loadDocuments();
    } else {
        showMessage('모든 파일 업로드 실패', 'error');
        uploadStatus.innerHTML = '<div class="text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>업로드 실패</div>';
    }
}

let renameDocumentId = null;

function renameDocument(id, currentName) {
    renameDocumentId = id;
    document.getElementById('newDocumentName').value = currentName;
    document.getElementById('renameModal').classList.remove('hidden');
    document.getElementById('renameModal').classList.add('flex');
}

function closeRenameModal() {
    renameDocumentId = null;
    document.getElementById('renameModal').classList.add('hidden');
    document.getElementById('renameModal').classList.remove('flex');
}

async function confirmRename() {
    const newName = document.getElementById('newDocumentName').value.trim();
    
    if (!newName) {
        showMessage('문서 이름을 입력해주세요.', 'error');
        return;
    }

    try {
        await axios.patch(`/api/documents/${renameDocumentId}`, 
            { title: newName },
            { headers: { 'Authorization': `Bearer ${authToken}` }}
        );
        
        showMessage('문서 이름이 변경되었습니다.', 'success');
        closeRenameModal();
        await loadDocuments();
    } catch (error) {
        console.error('Failed to rename document:', error);
        showMessage('문서 이름 변경에 실패했습니다.', 'error');
    }
}

async function deleteDocument(id, title) {
    if (!confirm(`"${title}" 문서를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }

    try {
        await axios.delete(`/api/documents/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        showMessage('문서가 삭제되었습니다.', 'success');
        await loadDocuments();
    } catch (error) {
        console.error('Failed to delete document:', error);
        showMessage('문서 삭제에 실패했습니다.', 'error');
    }
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = '/';
}

function showMessage(message, type = 'info') {
    const toast = document.getElementById('messageToast');
    const icon = document.getElementById('messageIcon');
    const text = document.getElementById('messageText');

    const icons = {
        success: 'fa-check-circle text-green-600',
        error: 'fa-exclamation-circle text-red-600',
        info: 'fa-info-circle text-primary-600'
    };

    icon.className = `fas ${icons[type]} mr-3 text-xl`;
    text.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function getFileIcon(fileType) {
    if (fileType.includes('pdf')) return 'fa-file-pdf';
    if (fileType.includes('word')) return 'fa-file-word';
    if (fileType.includes('powerpoint')) return 'fa-file-powerpoint';
    return 'fa-file-alt';
}

function getStatusColor(status) {
    const colors = {
        'processing': 'bg-yellow-100 text-yellow-800',
        'indexed': 'bg-green-100 text-green-800',
        'failed': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

function getStatusText(status) {
    const texts = {
        'processing': '처리중',
        'indexed': '완료',
        'failed': '실패'
    };
    return texts[status] || status;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
