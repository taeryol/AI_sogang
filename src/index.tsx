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
        <title>AI 지식 관리 시스템 (KMS)</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
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
                        <i class="fas fa-brain text-blue-600 text-2xl mr-3"></i>
                        <h1 class="text-xl font-bold text-gray-900">AI 지식 관리 시스템</h1>
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
                        <button id="loginBtn" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
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
                        <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-lg">
                            <h2 class="text-lg font-semibold">
                                <i class="fas fa-comments mr-2"></i>질문하기
                            </h2>
                            <p class="text-sm text-blue-100 mt-1">궁금한 내용을 자유롭게 질문해주세요</p>
                        </div>

                        <!-- Chat Messages -->
                        <div id="chatMessages" class="flex-1 overflow-y-auto p-6 space-y-4">
                            <!-- Welcome message -->
                            <div class="text-center text-gray-500 py-12">
                                <i class="fas fa-robot text-6xl text-blue-200 mb-4"></i>
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
                                    class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled
                                >
                                <button 
                                    id="sendBtn" 
                                    class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
                            <i class="fas fa-cloud-upload-alt text-blue-600 mr-2"></i>문서 업로드
                        </h3>
                        <div id="uploadLoginPrompt" class="text-center py-8">
                            <i class="fas fa-lock text-gray-400 text-4xl mb-3"></i>
                            <p class="text-sm text-gray-500 mb-3">로그인하여 문서를 업로드하세요</p>
                            <button onclick="document.getElementById('loginBtn').click()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                                <i class="fas fa-sign-in-alt mr-2"></i>로그인
                            </button>
                        </div>
                        <div id="uploadForm" class="hidden">
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">
                                    파일 선택
                                    <span class="text-xs text-gray-500 ml-2">(PDF, TXT, DOCX)</span>
                                </label>
                                <input 
                                    type="file" 
                                    id="documentFile" 
                                    accept=".pdf,.txt,.docx"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                            </div>
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">제목</label>
                                <input 
                                    type="text" 
                                    id="documentTitle" 
                                    placeholder="문서 제목 (선택사항)"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                            </div>
                            <button 
                                id="uploadBtn"
                                class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                <i class="fas fa-upload mr-2"></i>업로드
                            </button>
                            <div id="uploadProgress" class="hidden mt-3">
                                <div class="flex items-center text-sm text-blue-600">
                                    <i class="fas fa-spinner fa-spin mr-2"></i>
                                    <span id="uploadStatus">업로드 중...</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
                                    <div id="uploadProgressBar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                                </div>
                            </div>
                            <div id="uploadResult" class="hidden mt-3 p-3 rounded-lg text-sm"></div>
                        </div>
                    </div>

                    <!-- Stats Card -->
                    <div class="bg-white rounded-lg shadow p-6">
                        <h3 class="text-lg font-semibold mb-4">
                            <i class="fas fa-chart-bar text-blue-600 mr-2"></i>시스템 정보
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
                    <div class="bg-blue-50 rounded-lg p-6">
                        <h3 class="text-lg font-semibold mb-4 text-blue-900">
                            <i class="fas fa-lightbulb text-yellow-500 mr-2"></i>효과적인 질문 방법
                        </h3>
                        <ul class="space-y-2 text-sm text-blue-800">
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
                        <input type="email" id="loginEmail" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                    </div>
                    <div class="mb-6">
                        <label class="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
                        <input type="password" id="loginPassword" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                    </div>
                    <div class="flex space-x-3">
                        <button type="submit" class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">로그인</button>
                        <button type="button" id="closeLoginBtn" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">취소</button>
                    </div>
                </form>
                <div class="mt-4 text-center text-sm text-gray-600">
                    <p>계정이 없으신가요? <button id="switchToRegister" class="text-blue-600 hover:underline">회원가입</button></p>
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
                    <p>이미 계정이 있으신가요? <button id="switchToLogin" class="text-blue-600 hover:underline">로그인</button></p>
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
