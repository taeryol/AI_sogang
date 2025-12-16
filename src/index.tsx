import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/cloudflare-workers';
import { Bindings, Variables } from './types/bindings';

// Import routes
import authRoutes from './routes/auth';
import documentsRoutes from './routes/documents';
import queryRoutes from './routes/query';
import adminRoutes from './routes/admin';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware
app.use('*', logger());
app.use('/api/*', cors());

// Serve static files from public directory
app.use('/static/*', serveStatic({ root: './public' }));

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/documents', documentsRoutes);
app.route('/api/query', queryRoutes);
app.route('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'AI KMS'
  });
});

// Documents management page
app.get('/documents', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>문서 관리 - MindBase</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script>
            tailwind.config = {
                theme: {
                    extend: {
                        colors: {
                            primary: {
                                50: '#f0fdfa',
                                100: '#ccfbf1',
                                200: '#99f6e4',
                                300: '#5eead4',
                                400: '#2dd4bf',
                                500: '#14b8a6',
                                600: '#0d9488',
                                700: '#0f766e',
                                800: '#115e59',
                                900: '#134e4a',
                            }
                        }
                    }
                }
            }
        </script>
    </head>
    <body class="bg-gray-50">
        <div id="app"></div>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/documents.js"></script>
    </body>
    </html>
  `);
});

// Admin page
app.get('/admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>관리자 페이지 - AI KMS</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div id="app"></div>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/admin.js"></script>
    </body>
    </html>
  `);
});

// Main page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MindBase - AI 지식 관리 시스템</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script>
            tailwind.config = {
                theme: {
                    extend: {
                        colors: {
                            primary: {
                                50: '#f0fdfa',
                                100: '#ccfbf1',
                                200: '#99f6e4',
                                300: '#5eead4',
                                400: '#2dd4bf',
                                500: '#14b8a6',
                                600: '#0d9488',
                                700: '#0f766e',
                                800: '#115e59',
                                900: '#134e4a',
                            }
                        }
                    }
                }
            }
        </script>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            }
            .chat-message {
                animation: fadeIn 0.3s ease-in;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .loading-dots::after {
                content: '...';
                animation: dots 1.5s steps(4, end) infinite;
            }
            @keyframes dots {
                0%, 20% { content: '.'; }
                40% { content: '..'; }
                60%, 100% { content: '...'; }
            }
        </style>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white shadow-sm border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex items-center">
                        <img src="data:image/png;base64,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" alt="MindBase" class="h-10 mr-3">
                        <h1 class="text-xl font-bold text-gray-900">MindBase</h1>
                    </div>
                    <div class="flex items-center space-x-4">
                        <button id="historyBtn" class="text-gray-600 hover:text-gray-900">
                            <i class="fas fa-history mr-2"></i>히스토리
                        </button>
                        <button id="documentsBtn" class="text-gray-600 hover:text-gray-900 hidden">
                            <i class="fas fa-file-alt mr-2"></i>문서 관리
                        </button>
                        <a href="/admin" id="adminPageBtn" class="text-gray-600 hover:text-gray-900 hidden">
                            <i class="fas fa-cog mr-2"></i>관리자 페이지
                        </a>
                        <button id="registerBtn" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                            <i class="fas fa-user-plus mr-2"></i>회원가입
                        </button>
                        <button id="loginBtn" class="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">
                            <i class="fas fa-sign-in-alt mr-2"></i>로그인
                        </button>
                        <button id="logoutBtn" class="text-gray-600 hover:text-gray-900 hidden">
                            <i class="fas fa-sign-out-alt mr-2"></i>로그아웃
                        </button>
                        <span id="userInfo" class="text-gray-700 hidden">
                            <i class="fas fa-user mr-2"></i><span id="userName"></span>
                        </span>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Container -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- Chat Interface (Main) -->
                <div class="lg:col-span-2">
                    <div class="bg-white rounded-lg shadow-lg h-[calc(100vh-200px)] flex flex-col">
                        <!-- Chat Header -->
                        <div class="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
                            <div>
                                <h2 class="text-lg font-semibold">
                                    <i class="fas fa-comments mr-2"></i>질문하기
                                </h2>
                                <p class="text-sm text-primary-100 mt-1">궁금한 내용을 자유롭게 질문해주세요</p>
                            </div>
                            <button 
                                id="newChatBtn" 
                                class="hidden bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-all duration-200 text-sm flex items-center space-x-2"
                            >
                                <i class="fas fa-plus"></i>
                                <span>새 대화</span>
                            </button>
                        </div>

                        <!-- Chat Messages -->
                        <div id="chatMessages" class="flex-1 overflow-y-auto p-6 space-y-4">
                            <!-- Welcome message -->
                            <div class="text-center text-gray-500 py-12">
                                <i class="fas fa-robot text-6xl text-primary-200 mb-4"></i>
                                <p class="text-lg font-medium mb-2">AI 지식 관리 시스템에 오신 것을 환영합니다</p>
                                <p class="text-sm">문서 기반 질문에 대해 AI가 정확한 답변을 제공합니다</p>
                            </div>
                        </div>

                        <!-- Chat Input -->
                        <div class="border-t border-gray-200 p-4 bg-gray-50 rounded-b-lg">
                            <div class="flex space-x-2">
                                <input 
                                    type="text" 
                                    id="questionInput" 
                                    placeholder="질문을 입력하세요..." 
                                    class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    disabled
                                >
                                <button 
                                    id="sendBtn" 
                                    class="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    disabled
                                >
                                    <i class="fas fa-paper-plane"></i>
                                </button>
                            </div>
                            <p class="text-xs text-gray-500 mt-2">
                                <i class="fas fa-info-circle mr-1"></i>
                                로그인 후 질문할 수 있습니다
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Sidebar -->
                <div class="space-y-6">
                    <!-- Document Upload Card -->
                    <div class="bg-white rounded-lg shadow p-6" id="uploadSection">
                        <h3 class="text-lg font-semibold mb-4">
                            <i class="fas fa-cloud-upload-alt text-primary-600 mr-2"></i>문서 업로드
                        </h3>
                        <div id="uploadLoginPrompt" class="text-center py-8">
                            <i class="fas fa-lock text-gray-400 text-4xl mb-3"></i>
                            <p class="text-sm text-gray-500 mb-3">로그인하여 문서를 업로드하세요</p>
                            <button onclick="document.getElementById('loginBtn').click()" class="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 text-sm">
                                <i class="fas fa-sign-in-alt mr-2"></i>로그인
                            </button>
                        </div>
                        <div id="uploadForm" class="hidden">
                            <!-- Drag & Drop Area -->
                            <div 
                                id="dropZone" 
                                class="mb-4 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition-all duration-200 hover:border-primary-500 hover:bg-primary-50"
                            >
                                <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3"></i>
                                <p class="text-sm text-gray-600 mb-2">
                                    <span class="font-semibold text-primary-600">클릭</span>하거나 <span class="font-semibold text-primary-600">드래그</span>하여 파일을 업로드하세요
                                </p>
                                <p class="text-xs text-gray-500">
                                    PDF, DOCX, PPTX, TXT, MD (최대 10MB)
                                </p>
                                <input 
                                    type="file" 
                                    id="documentFile" 
                                    accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.markdown"
                                    multiple
                                    class="hidden"
                                >
                            </div>
                            <!-- Selected Files Preview -->
                            <div id="selectedFilesPreview" class="hidden mb-4 p-3 bg-gray-50 rounded-lg">
                                <p class="text-xs font-semibold text-gray-700 mb-2">선택된 파일:</p>
                                <div id="selectedFilesList" class="space-y-1 text-xs text-gray-600"></div>
                            </div>
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">제목</label>
                                <input 
                                    type="text" 
                                    id="documentTitle" 
                                    placeholder="문서 제목 (선택사항)"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                            </div>
                            <button 
                                id="uploadBtn"
                                class="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                <i class="fas fa-upload mr-2"></i>업로드
                            </button>
                            <div id="uploadProgress" class="hidden mt-3">
                                <div class="flex items-center text-sm text-primary-600">
                                    <i class="fas fa-spinner fa-spin mr-2"></i>
                                    <span id="uploadStatus">업로드 중...</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
                                    <div id="uploadProgressBar" class="bg-primary-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                                </div>
                            </div>
                            <div id="uploadResult" class="hidden mt-3 p-3 rounded-lg text-sm"></div>
                        </div>
                        
                        <!-- Uploaded Documents List -->
                        <div class="mt-6 hidden" id="documentsListSection">
                            <div class="flex justify-between items-center mb-3">
                                <h4 class="text-sm font-semibold text-gray-700">
                                    <i class="fas fa-file-alt text-primary-600 mr-2"></i>업로드된 문서
                                </h4>
                                <button 
                                    onclick="loadDocumentsList()" 
                                    class="text-xs text-primary-600 hover:text-primary-800"
                                    title="새로고침"
                                >
                                    <i class="fas fa-sync-alt"></i>
                                </button>
                            </div>
                            <div id="documentsList" class="space-y-2 max-h-96 overflow-y-auto">
                                <!-- Documents will be loaded here -->
                            </div>
                        </div>
                    </div>

                    <!-- Stats Card -->
                    <div class="bg-white rounded-lg shadow p-6">
                        <h3 class="text-lg font-semibold mb-4">
                            <i class="fas fa-chart-bar text-primary-600 mr-2"></i>시스템 정보
                        </h3>
                        <div class="space-y-3">
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">등록된 문서</span>
                                <span class="font-semibold" id="docCount">0</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">총 질문 수</span>
                                <span class="font-semibold" id="queryCount">0</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">평균 응답시간</span>
                                <span class="font-semibold" id="avgResponse">-</span>
                            </div>
                        </div>
                    </div>

                    <!-- Quick Tips -->
                    <div class="bg-primary-50 rounded-lg p-6">
                        <h3 class="text-lg font-semibold mb-4 text-primary-900">
                            <i class="fas fa-lightbulb text-yellow-500 mr-2"></i>효과적인 질문 방법
                        </h3>
                        <ul class="space-y-2 text-sm text-primary-800">
                            <li><i class="fas fa-check text-green-500 mr-2"></i>구체적으로 질문하기</li>
                            <li><i class="fas fa-check text-green-500 mr-2"></i>키워드 포함하기</li>
                            <li><i class="fas fa-check text-green-500 mr-2"></i>문맥 정보 제공하기</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <!-- Login Modal -->
        <div id="loginModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
                <h2 class="text-2xl font-bold mb-6">로그인</h2>
                <form id="loginForm">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                        <input type="email" id="loginEmail" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" required>
                    </div>
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
                        <input type="password" id="loginPassword" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" required>
                    </div>
                    <div class="flex space-x-3">
                        <button type="submit" class="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700">로그인</button>
                        <button type="button" id="closeLoginBtn" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">취소</button>
                    </div>
                </form>
                <div class="mt-4 text-center text-sm text-gray-600">
                    <p>계정이 없으신가요? <button id="switchToRegister" class="text-primary-600 hover:underline">회원가입</button></p>
                    <p class="mt-2 text-xs text-gray-500">개발 테스트 계정: admin@company.com / admin123</p>
                </div>
            </div>
        </div>

        <!-- Register Modal -->
        <div id="registerModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
                <h2 class="text-2xl font-bold mb-6">회원가입</h2>
                <form id="registerForm">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">이름</label>
                        <input type="text" id="registerName" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">이메일</label>
                        <input type="email" id="registerEmail" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
                        <input type="password" id="registerPassword" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" required minlength="6">
                        <p class="text-xs text-gray-500 mt-1">최소 6자 이상</p>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">비밀번호 확인</label>
                        <input type="password" id="registerPasswordConfirm" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" required minlength="6">
                    </div>
                    <div class="mb-6 border-t pt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            관리자 코드 (선택사항)
                            <span class="text-xs text-gray-500 font-normal ml-2">관리자 권한이 필요한 경우만 입력</span>
                        </label>
                        <input type="text" id="registerAdminCode" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="ADMIN-XXXXXXXX">
                        <p class="text-xs text-purple-600 mt-1">💡 기본 개발 코드: ADMIN-SETUP-2025</p>
                    </div>
                    <div class="flex space-x-3">
                        <button type="submit" class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">가입하기</button>
                        <button type="button" id="closeRegisterBtn" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">취소</button>
                    </div>
                </form>
                <div class="mt-4 text-center text-sm text-gray-600">
                    <p>이미 계정이 있으신가요? <button id="switchToLogin" class="text-primary-600 hover:underline">로그인</button></p>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `);
});

export default app;
