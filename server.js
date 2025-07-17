const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const port = 3000;

// 启用详细日志
const enableDebug = true;
function debugLog(...args) {
  if (enableDebug) {
    console.log('[DEBUG]', new Date().toISOString(), ...args);
  }
}

// 中间件
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// --- V8 修正: 确保上传目录存在 ---
const UPLOADS_DIR = 'uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
  debugLog(`创建目录: ${UPLOADS_DIR}`);
}

// --- V8 修正: 配置文件上传 ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    debugLog('准备保存文件...');
    
    // --- V8 修正: 在上传前清空uploads文件夹 ---
    fs.readdir(UPLOADS_DIR, (err, files) => {
      if (err) {
        debugLog('读取uploads目录失败:', err);
        // 即使读取失败，也继续尝试保存
        return cb(null, UPLOADS_DIR);
      }

      for (const f of files) {
        fs.unlink(path.join(UPLOADS_DIR, f), err => {
          if (err) {
            debugLog(`删除文件 ${f} 失败:`, err);
          } else {
            debugLog(`已删除旧文件: ${f}`);
          }
        });
      }
      cb(null, UPLOADS_DIR);
    });
  },
  filename: function (req, file, cb) {
    try {
      // --- V10 修正: 直接使用净化的原始文件名存储 ---
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      
      // 净化文件名，移除非法字符，但保留原始名称
      const ext = path.extname(originalName);
      const baseName = path.basename(originalName, ext);
      const sanitizedBaseName = baseName.replace(/[^\w\u4e00-\u9fa5-]/g, '_');
      
      const finalFilename = sanitizedBaseName + ext;
      
      debugLog('使用净化的原始文件名:', finalFilename);
      cb(null, finalFilename);
    } catch (error) {
      debugLog('文件名处理错误:', error);
      const timestamp = Date.now();
      const fallbackFilename = `audio_${timestamp}.mp3`;
      debugLog('使用默认文件名:', fallbackFilename);
      cb(null, fallbackFilename);
    }
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function(req, file, cb) {
    debugLog('收到上传文件:', file.originalname, 'mimetype:', file.mimetype);
    
    // 只允许上传音频文件 - 检查MIME类型和扩展名
    const validMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3', 'audio/wave'];
    const validExtensions = /\.(mp3|wav|ogg)$/i;
    
    if (validMimeTypes.includes(file.mimetype) || validExtensions.test(file.originalname)) {
      debugLog('文件类型验证通过');
      cb(null, true);
    } else {
      debugLog('文件类型验证失败');
      cb(new Error('只允许上传MP3, WAV或OGG格式的音频文件!'), false);
    }
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  debugLog('发生错误:', err);
  res.status(500).json({
    success: false,
    error: err.message || '服务器发生未知错误'
  });
});

// 路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 上传音乐文件
app.post('/upload', function(req, res) {
  debugLog('接收到上传请求');
  
  const uploadSingle = upload.single('music');
  
  uploadSingle(req, res, function(err) {
    if (err) {
      debugLog('上传错误:', err);
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    
    if (!req.file) {
      debugLog('没有文件被上传');
      return res.status(400).json({
        success: false,
        error: '没有文件被上传'
      });
    }
    
    debugLog('文件上传成功:', req.file);
    
    try {
      let originalName = req.file.originalname;
      try {
        // 尝试处理文件名编码
        originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        debugLog('解码后的文件名:', originalName);
      } catch (encodeError) {
        debugLog('文件名编码处理错误，使用原始文件名:', encodeError);
      }
      
      const fileData = {
        filename: req.file.filename,
        originalname: originalName,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      };
      
      debugLog('发送上传响应:', fileData);
      
      res.json({
        success: true,
        file: fileData
      });
    } catch (error) {
      debugLog('处理上传文件时出错:', error);
      res.status(500).json({
        success: false,
        error: '处理上传文件时出错'
      });
    }
  });
});

// 保存谱面数据
app.post('/save', (req, res) => {
  debugLog('接收到保存请求');
  const data = req.body;
  
  if (!data) {
    debugLog('没有提供谱面数据');
    return res.status(400).json({
      success: false,
      error: '没有提供谱面数据'
    });
  }
  
  // 使用安全的文件名，只保留字母、数字、中文字符
  let songName = (data.name || 'track').replace(/[^\w\u4e00-\u9fa5]/g, '_');
  if (!songName || songName.length === 0) songName = 'track';
  
  const timestamp = Date.now();
  const filename = `${songName}_${timestamp}.json`;
  const filepath = path.join(__dirname, 'uploads', filename);
  
  debugLog('保存谱面到文件:', filepath);

  // 添加延迟，模拟文件保存过程
  setTimeout(() => {
    fs.writeFile(filepath, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        debugLog('保存文件失败:', err);
        return res.status(500).json({
          success: false,
          error: '保存文件失败'
        });
      }
      
      debugLog('文件保存成功');
      res.json({ 
        success: true, 
        message: '文件保存成功',
        filename: filename,
        downloadUrl: `/uploads/${filename}`
      });
    });
  }, 800);
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});